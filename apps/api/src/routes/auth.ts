import express from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import { signToken } from '../utils/auth';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash, name, role: 'USER' } });
    const token = signToken({ userId: user.id, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ userId: user.id, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.post('/guest', async (req, res) => {
  try {
    const { name } = req.body;
    const email = `guest+${Date.now()}@meechlocs.local`;
    const passwordHash = await bcrypt.hash(Math.random().toString(36).slice(2, 10), 10);
    
    const user = await prisma.user.create({ data: { email, passwordHash, name: name || 'Guest', isGuest: true, role: 'USER' } });
    const token = signToken({ userId: user.id, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const parts = auth.split(' ');
    if (parts.length !== 2) return res.status(401).json({ error: 'Unauthorized' });
    const token = parts[1];
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'your_jwt_secret_here';
    try {
      const payload: any = jwt.verify(token, secret);
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
