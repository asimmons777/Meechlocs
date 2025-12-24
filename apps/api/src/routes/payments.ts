import express from 'express'
import Stripe from 'stripe'
import { prisma } from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2022-11-15' } as any)
const hasStripeKey = (k?: string) => !!k && k.length > 20 && !k.includes('...')

// List saved card payment methods for authenticated user
router.get('/methods', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.stripeCustomerId) return res.json({ methods: [] })
    if (!hasStripeKey(process.env.STRIPE_SECRET_KEY)) return res.json({ methods: [] })
    const pm = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card' })
    const methods = pm.data.map(m => ({ id: m.id, brand: (m.card as any)?.brand, last4: (m.card as any)?.last4, exp_month: (m.card as any)?.exp_month, exp_year: (m.card as any)?.exp_year }))
    res.json({ methods })
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

export default router
