import express from 'express'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireAdmin, AuthRequest } from '../middleware/auth'
import Stripe from 'stripe'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2022-11-15' } as any)

// setup multer to save uploads to the frontend public/uploads directory for demo
const uploadDir = path.join(__dirname, '../../../apps/web/public/uploads')
fs.mkdirSync(uploadDir, { recursive: true })
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir) },
  filename: function (req, file, cb) { const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_'); cb(null, safe) }
})
const upload = multer({ storage })

// All admin routes require auth and admin role
router.use(authMiddleware)
router.use(requireAdmin)

// Services CRUD
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
    const url = `${process.env.APP_URL || 'http://localhost:5173'}/uploads/${req.file.filename}`
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
    const overlapping = await prisma.appointment.findMany({ where: { start: { gte: avail.start }, end: { lte: avail.end }, status: { not: 'CANCELED' } } })
    for (const ap of overlapping) {
      await prisma.appointment.update({ where: { id: ap.id }, data: { status: 'CANCELED' } })
    }

    await prisma.availability.delete({ where: { id } })
    res.json({ ok: true, canceledAppointments: overlapping.length })
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

// Refund endpoint
router.post('/refund', async (req: AuthRequest, res) => {
  const { appointmentId } = req.body
  try {
    const ap = await prisma.appointment.findUnique({ where: { id: Number(appointmentId) } })
    if (!ap || !ap.stripePaymentIntent) return res.status(400).json({ error: 'No payment to refund' })
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('...')) {
      return res.status(400).json({ error: 'Stripe not configured for refunds in this environment' })
    }
    const refund = await stripe.refunds.create({ payment_intent: ap.stripePaymentIntent })
    await prisma.appointment.update({ where: { id: ap.id }, data: { status: 'REFUNDED' } })
    res.json({ ok: true, refund })
  } catch (err:any) { console.error(err); res.status(500).json({ error: err.message || 'server error' }) }
})

// Admin: list all appointments
router.get('/appointments', async (req: AuthRequest, res) => {
  try {
    const appts = await prisma.appointment.findMany({ include: { service: true, user: true }, orderBy: { start: 'desc' } })
    res.json(appts)
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

export default router
