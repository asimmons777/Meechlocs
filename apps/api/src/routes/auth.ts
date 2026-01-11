import express from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getTokenFromHeader, JWT_SECRET, signToken } from '../utils/auth';
import sgMail from '@sendgrid/mail';
import { isDemoEmail, shouldHideDemoContent } from '../utils/demo';

const router = express.Router();

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /.+@.+\..+/.test(value);
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D+/g, '');
  if (!digits) return null;
  // Keep it simple for now; store digits only.
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function generate6DigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendVerificationEmail(toEmail: string, code: string) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM;

  if (apiKey && fromEmail) {
    try {
      sgMail.setApiKey(apiKey);
      await sgMail.send({
        to: toEmail,
        from: fromEmail,
        subject: 'Your MeechLocs verification code',
        text: `Your MeechLocs verification code is: ${code}. This code expires in 10 minutes.`,
      });
      return { delivered: true };
    } catch (err) {
      console.error('[auth] SendGrid verification email failed:', err);
      return { delivered: false };
    }
  }

  // Dev fallback: log code (no email provider configured).
  console.log(`[auth] Verification code for ${toEmail}: ${code}`);
  return { delivered: false };
}

function baseUrl(): string {
  const appUrl = (process.env.APP_URL || '').trim();
  if (appUrl) return appUrl.replace(/\/$/, '');
  // Local fallback (Vite default)
  return 'http://localhost:5173';
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateResetToken(): string {
  // 64 hex chars
  return crypto.randomBytes(32).toString('hex');
}

async function sendPasswordResetEmail(toEmail: string, resetUrl: string) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM;

  if (apiKey && fromEmail) {
    try {
      sgMail.setApiKey(apiKey);
      await sgMail.send({
        to: toEmail,
        from: fromEmail,
        subject: 'Reset your MeechLocs password',
        text: `Use this link to reset your password (expires in 60 minutes): ${resetUrl}`,
      });
      return { delivered: true };
    } catch (err) {
      console.error('[auth] SendGrid password reset email failed:', err);
      return { delivered: false };
    }
  }

  console.log(`[auth] Password reset link for ${toEmail}: ${resetUrl}`);
  return { delivered: false };
}

router.post('/register/start', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!isEmail(email)) return res.status(400).send('Valid email is required');
    if (shouldHideDemoContent() && isDemoEmail(email)) return res.status(403).send('Account is disabled');
    if (!password || typeof password !== 'string') return res.status(400).send('password required');
    if (password.length < 6) return res.status(400).send('Password must be at least 6 characters');

    const normalizedPhone = normalizePhone(phone);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).send('User already exists');

    const code = generate6DigitCode();
    const [passwordHash, codeHash] = await Promise.all([
      bcrypt.hash(password, 10),
      bcrypt.hash(code, 10),
    ]);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.registrationCode.upsert({
      where: { email },
      create: { email, phone: normalizedPhone, name, passwordHash, codeHash, expiresAt },
      update: { phone: normalizedPhone, name, passwordHash, codeHash, expiresAt },
    });

    const delivery = await sendVerificationEmail(email, code);

    const isProd = process.env.NODE_ENV === 'production';
    if (!delivery.delivered && isProd) {
      return res.status(500).json({ error: 'Email delivery is not configured' });
    }
    if (!delivery.delivered && !isProd) {
      // Helpful for local dev/demo.
      return res.json({ ok: true, devCode: code });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('server error');
  }
});

router.post('/register/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!isEmail(email)) return res.status(400).send('Valid email is required');
    if (shouldHideDemoContent() && isDemoEmail(email)) return res.status(403).send('Account is disabled');
    if (!code || typeof code !== 'string') return res.status(400).send('code required');

    const record = await prisma.registrationCode.findUnique({ where: { email } });
    if (!record) return res.status(400).send('No pending verification for this email');
    if (record.expiresAt.getTime() < Date.now()) return res.status(400).send('Verification code expired');

    const ok = await bcrypt.compare(code, record.codeHash);
    if (!ok) return res.status(401).send('Invalid verification code');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).send('User already exists');

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: record.passwordHash,
        name: record.name,
        phone: record.phone,
        verifiedAt: new Date(),
        role: 'USER',
      },
    });

    await prisma.registrationCode.delete({ where: { email } });

    const token = signToken({ userId: user.id, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).send('server error');
  }
});

router.post('/register', async (req, res) => {
  try {
    // Back-compat endpoint: kick off email verification instead of creating the user immediately.
    // Frontend should use /register/start + /register/verify.
    return res.status(410).send('Registration now requires email verification. Use /api/auth/register/start');
  } catch (err) {
    console.error(err);
    res.status(500).send('server error');
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    if (typeof email === 'string' && shouldHideDemoContent() && isDemoEmail(email)) {
      return res.status(403).json({ error: 'Account is disabled' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (shouldHideDemoContent() && isDemoEmail(user.email)) {
      return res.status(403).json({ error: 'Account is disabled' });
    }
    const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
    if (requireVerification && !user.isGuest && !user.verifiedAt) {
      return res.status(403).json({ error: 'Email not verified' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ userId: user.id, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Request a password reset link.
// Always returns ok: true to avoid revealing whether an email exists.
router.post('/password/forgot', async (req, res) => {
  try {
    const { email } = req.body;
    if (!isEmail(email)) return res.status(400).send('Valid email is required');
    if (shouldHideDemoContent() && isDemoEmail(email)) {
      return res.json({ ok: true });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ ok: true });
    }

    const token = generateResetToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Remove any existing unused tokens for this user to keep things simple.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const resetUrl = `${baseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const delivery = await sendPasswordResetEmail(email, resetUrl);

    const isProd = process.env.NODE_ENV === 'production';
    if (!delivery.delivered && !isProd) {
      return res.json({ ok: true, devResetUrl: resetUrl });
    }

    // In production, if email isn't configured, we still return ok to avoid leaking info.
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('server error');
  }
});

router.post('/password/reset', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || typeof token !== 'string') return res.status(400).send('token required');
    if (!password || typeof password !== 'string') return res.status(400).send('password required');
    if (password.length < 6) return res.status(400).send('Password must be at least 6 characters');

    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record) return res.status(400).send('Invalid or expired token');
    if (record.usedAt) return res.status(400).send('Invalid or expired token');
    if (record.expiresAt.getTime() < Date.now()) return res.status(400).send('Invalid or expired token');

    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) return res.status(400).send('Invalid or expired token');
    if (shouldHideDemoContent() && isDemoEmail(user.email)) return res.status(403).send('Account is disabled');

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, id: { not: record.id } },
      }),
    ]);

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('server error');
  }
});

router.post('/guest/start', async (req, res) => {
  try {
    const { email, name, phone } = req.body;
    if (!isEmail(email)) return res.status(400).send('Valid email is required');
    if (shouldHideDemoContent() && isDemoEmail(email)) return res.status(403).send('Account is disabled');

    const normalizedPhone = normalizePhone(phone);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).send('An account with this email already exists. Please log in.');

    const code = generate6DigitCode();
    const randomPassword = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    const [passwordHash, codeHash] = await Promise.all([
      bcrypt.hash(randomPassword, 10),
      bcrypt.hash(code, 10),
    ]);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.registrationCode.upsert({
      where: { email },
      create: { email, phone: normalizedPhone, name: name || 'Guest', passwordHash, codeHash, expiresAt },
      update: { phone: normalizedPhone, name: name || 'Guest', passwordHash, codeHash, expiresAt },
    });

    const delivery = await sendVerificationEmail(email, code);

    const isProd = process.env.NODE_ENV === 'production';
    if (!delivery.delivered && isProd) {
      return res.status(500).json({ error: 'Email delivery is not configured' });
    }
    if (!delivery.delivered && !isProd) {
      return res.json({ ok: true, devCode: code });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('server error');
  }
});

router.post('/guest/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!isEmail(email)) return res.status(400).send('Valid email is required');
    if (shouldHideDemoContent() && isDemoEmail(email)) return res.status(403).send('Account is disabled');
    if (!code || typeof code !== 'string') return res.status(400).send('code required');

    const record = await prisma.registrationCode.findUnique({ where: { email } });
    if (!record) return res.status(400).send('No pending verification for this email');
    if (record.expiresAt.getTime() < Date.now()) return res.status(400).send('Verification code expired');

    const ok = await bcrypt.compare(code, record.codeHash);
    if (!ok) return res.status(401).send('Invalid verification code');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).send('An account with this email already exists. Please log in.');

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: record.passwordHash,
        name: record.name,
        phone: record.phone,
        verifiedAt: new Date(),
        role: 'USER',
        isGuest: true,
      },
    });

    await prisma.registrationCode.delete({ where: { email } });

    const token = signToken({ userId: user.id, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).send('server error');
  }
});

router.post('/guest', async (req, res) => {
  return res.status(410).send('Guest access now requires email verification. Use /api/auth/guest/start');
});

router.get('/me', async (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const payload: any = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: Number(payload.userId) } });
      if (!user) return res.status(404).json({ error: 'Not found' });
      return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
    } catch (e: any) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

export default router;
