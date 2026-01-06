import express from 'express'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireAdmin, AuthRequest } from '../middleware/auth'
import Stripe from 'stripe'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2022-11-15' } as any)
const hasStripeKey = (k?: string) => !!k && k.length > 20 && !k.includes('...')

// Store uploads in the API's filesystem and serve them from /uploads
const uploadDir = (process.env.UPLOAD_DIR && process.env.UPLOAD_DIR.trim())
  ? process.env.UPLOAD_DIR.trim()
  : path.join(process.cwd(), 'uploads')

// Best-effort one-time migration from legacy paths (if they exist)
const legacyUploadDirs = [
  path.join(__dirname, '../../../web/public/uploads'),
  path.join(__dirname, '../../../apps/web/public/uploads'),
]
try { fs.mkdirSync(uploadDir, { recursive: true }) } catch { /* ignore */ }
try{
  for(const legacyDir of legacyUploadDirs){
    if(!fs.existsSync(legacyDir)) continue
    for(const name of fs.readdirSync(legacyDir)){
      const src = path.join(legacyDir, name)
      const dst = path.join(uploadDir, name)
      try{
        if(!fs.existsSync(dst) && fs.statSync(src).isFile()) fs.copyFileSync(src, dst)
      }catch{ /* ignore */ }
    }
  }
}catch{ /* ignore */ }
const storage = multer.diskStorage({
  destination: function (req: express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) { cb(null, uploadDir) },
  filename: function (req: express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) { const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_'); cb(null, safe) }
})
const upload = multer({ storage })

// All admin routes require auth and admin role
router.use(authMiddleware)
router.use(requireAdmin)

// Services CRUD
router.get('/services', async (req: AuthRequest, res) => {
  try {
    const services = await prisma.service.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(services)
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

router.post('/services', async (req: AuthRequest, res) => {
  const { title, description, durationMins, priceCents, depositCents, images } = req.body
  try {
    const s = await prisma.service.create({ data: { title, description, durationMins, priceCents, depositCents, images } })
    res.json(s)
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

router.put('/services/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id)
  try {
    const s = await prisma.service.update({ where: { id }, data: req.body })
    res.json(s)
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

router.delete('/services/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.service.delete({ where: { id } })
    res.json({ ok: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

// Availability
router.post('/availability', async (req: AuthRequest, res) => {
  const { start, end } = req.body
  try {
    const a = await prisma.availability.create({ data: { start: new Date(start), end: new Date(end) } })
    res.json(a)
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

// Upload image (admin only)
router.post('/upload', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' })
    const url = `/uploads/${req.file.filename}`
    res.json({ url })
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

router.delete('/availability/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id)
  try {
    // find availability range
    const avail = await prisma.availability.findUnique({ where: { id } })
    if (!avail) return res.status(404).json({ error: 'Not found' })

    // cancel overlapping appointments
    const overlapping = await prisma.appointment.findMany({ where: { start: { gte: avail.start }, end: { lte: avail.end }, status: { notIn: ['CANCELED', 'REFUNDED'] } } })
    for (const ap of overlapping) {
      await prisma.appointment.update({ where: { id: ap.id }, data: { status: 'CANCELED' } })
    }

    await prisma.availability.delete({ where: { id } })
    res.json({ ok: true, canceledAppointments: overlapping.length })
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

// Refund endpoint
router.post('/refund', async (req: AuthRequest, res) => {
  const { appointmentId, amountCents } = req.body
  try {
    const ap = await prisma.appointment.findUnique({ where: { id: Number(appointmentId) } })
    if (!ap || !ap.stripePaymentIntent) return res.status(400).json({ error: 'No payment to refund' })
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('...')) {
      return res.status(400).json({ error: 'Stripe not configured for refunds in this environment' })
    }

    let refundAmount: number | undefined
    if (amountCents !== undefined && amountCents !== null && amountCents !== '') {
      const parsed = Number(amountCents)
      if (!Number.isFinite(parsed) || parsed <= 0 || Math.floor(parsed) !== parsed) {
        return res.status(400).json({ error: 'amountCents must be a positive integer' })
      }
      refundAmount = parsed
    }

    // If an amount is provided, validate it against the PaymentIntent.
    let isFullRefund = false
    if (refundAmount !== undefined) {
      const pi = await stripe.paymentIntents.retrieve(ap.stripePaymentIntent)
      const maxRefundable = (pi.amount_received && pi.amount_received > 0) ? pi.amount_received : pi.amount
      if (!maxRefundable || maxRefundable <= 0) {
        return res.status(400).json({ error: 'Payment not captured/settled yet; cannot refund' })
      }
      if (refundAmount > maxRefundable) {
        return res.status(400).json({ error: `Refund amount exceeds payment total (${maxRefundable})` })
      }
      isFullRefund = refundAmount === maxRefundable
    }

    const refund = await stripe.refunds.create({
      payment_intent: ap.stripePaymentIntent,
      ...(refundAmount !== undefined ? { amount: refundAmount } : {}),
    })

    if (refundAmount === undefined || isFullRefund) {
      await prisma.appointment.update({ where: { id: ap.id }, data: { status: 'REFUNDED' } })
    }

    res.json({ ok: true, refund, refundedAmountCents: refund.amount, fullRefund: refundAmount === undefined ? true : isFullRefund })
  } catch (err:any) { console.error(err); res.status(500).json({ error: err.message || 'server error' }) }
})

// Admin: list all appointments
router.get('/appointments', async (req: AuthRequest, res) => {
  try {
    const appts = await prisma.appointment.findMany({ include: { service: true, user: true }, orderBy: { start: 'desc' } })

    const withPaid = await Promise.all(
      appts.map(async (ap: any) => {
        let amountPaidCents: number | null = null

        if (ap.stripePaymentIntent && hasStripeKey(process.env.STRIPE_SECRET_KEY)) {
          try {
            const pi = await stripe.paymentIntents.retrieve(ap.stripePaymentIntent)
            const amt = (pi.amount_received && pi.amount_received > 0) ? pi.amount_received : pi.amount
            if (typeof amt === 'number' && amt > 0) amountPaidCents = amt
          } catch (e) {
            // best-effort; fall back below
          }
        }

        // Fallbacks when Stripe isn't available: treat this as a deposit-only flow.
        if (amountPaidCents == null) {
          if (ap.service?.depositCents) amountPaidCents = Number(ap.service.depositCents)
          else if (ap.service?.priceCents) amountPaidCents = Number(ap.service.priceCents)
        }

        const depositCents = ap.service?.depositCents ? Number(ap.service.depositCents) : null
        const priceCents = ap.service?.priceCents ? Number(ap.service.priceCents) : null

        let paidType: 'DEPOSIT' | 'FULL' | 'CUSTOM' | 'UNKNOWN' = 'UNKNOWN'
        if (amountPaidCents != null && amountPaidCents > 0) {
          if (priceCents != null && priceCents > 0 && amountPaidCents >= priceCents) paidType = 'FULL'
          else if (depositCents != null && depositCents > 0 && amountPaidCents === depositCents) paidType = 'DEPOSIT'
          else paidType = 'CUSTOM'
        }

        return { ...ap, amountPaidCents, paidType }
      })
    )

    res.json(withPaid)
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

export default router
