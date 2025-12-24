import express from 'express'
import { prisma } from '../lib/prisma'
import Stripe from 'stripe'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2022-11-15' } as any)
const hasStripeKey = (k?: string) => !!k && k.length > 20 && !k.includes('...')

// Create appointment (authenticated)
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { serviceId, start, end } = req.body
    const userId = req.user?.id
    if (!userId || !serviceId || !start || !end) return res.status(400).json({ error: 'Missing fields' })

    const overlapping = await prisma.appointment.findFirst({
      where: {
        OR: [
          { AND: [{ start: { lte: new Date(start) } }, { end: { gt: new Date(start) } }] },
          { AND: [{ start: { lt: new Date(end) } }, { end: { gte: new Date(end) } }] },
          { AND: [{ start: { gte: new Date(start) } }, { end: { lte: new Date(end) } }] }
        ],
        status: { not: 'CANCELED' }
      }
    })

    if (overlapping) return res.status(400).json({ error: 'Time slot is not available' })

    const appointment = await prisma.appointment.create({ data: { userId, serviceId, start: new Date(start), end: new Date(end), status: 'PENDING' } })

    const service = await prisma.service.findUnique({ where: { id: Number(serviceId) } })
    if (!service) return res.status(400).json({ error: 'Service not found' })

    if (hasStripeKey(process.env.STRIPE_SECRET_KEY)) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price_data: { currency: 'usd', product_data: { name: service.title, description: service.description || undefined }, unit_amount: service.depositCents }, quantity: 1 }],
        client_reference_id: String(appointment.id),
        success_url: `${process.env.APP_URL || 'http://localhost:5173'}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:5173'}/booking/cancel`,
        customer_email: req.user?.email,
        payment_intent_data: {}
      })

      await prisma.appointment.update({ where: { id: appointment.id }, data: { stripeSessionId: session.id } })
      return res.json({ appointment, checkoutUrl: session.url })
    }

    res.json({ appointment })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

// List appointments (optionally by userId)
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.query.userId) || req.user?.id
    const appts = await prisma.appointment.findMany({ where: { userId }, include: { service: true } })
    res.json(appts)
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

export default router

