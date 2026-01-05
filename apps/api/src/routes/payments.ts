import express from 'express'
import Stripe from 'stripe'
import { prisma } from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2022-11-15' } as any)
const hasStripeKey = (k?: string) => !!k && k.length > 20 && !k.includes('...')

async function getOrCreateCustomerId(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (!hasStripeKey(process.env.STRIPE_SECRET_KEY)) return null
  if (user.stripeCustomerId) return user.stripeCustomerId
  const cust = await stripe.customers.create({ email: user.email })
  await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: cust.id } })
  return cust.id
}

// List saved card payment methods for authenticated user
router.get('/methods', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.stripeCustomerId) return res.json({ methods: [], defaultPaymentMethodId: null })
    if (!hasStripeKey(process.env.STRIPE_SECRET_KEY)) return res.json({ methods: [], defaultPaymentMethodId: null })

    const customer = await stripe.customers.retrieve(user.stripeCustomerId)
    const defaultPaymentMethodId = (customer as any)?.invoice_settings?.default_payment_method || null

    const pm = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card' })
    const methods = pm.data.map(m => ({
      id: m.id,
      brand: (m.card as any)?.brand,
      last4: (m.card as any)?.last4,
      exp_month: (m.card as any)?.exp_month,
      exp_year: (m.card as any)?.exp_year,
      isDefault: defaultPaymentMethodId ? m.id === defaultPaymentMethodId : false,
    }))
    res.json({ methods, defaultPaymentMethodId })
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

// Create a Stripe-hosted "setup" Checkout Session so users can add/change their saved card.
router.post('/setup-session', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { returnPath } = (req.body || {}) as { returnPath?: string }
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    if (!hasStripeKey(process.env.STRIPE_SECRET_KEY)) return res.status(400).json({ error: 'Stripe not configured' })

    const customerId = await getOrCreateCustomerId(userId)
    if (!customerId) return res.status(400).json({ error: 'Stripe not configured' })

    const appUrl = process.env.APP_URL || 'http://localhost:5173'

    const safeReturnPath = typeof returnPath === 'string' && returnPath.startsWith('/') && !returnPath.startsWith('//')
      ? returnPath
      : null

    const withPmUpdated = (p: string) => (p.includes('?') ? `${p}&pm=updated` : `${p}?pm=updated`)
    const successPath = safeReturnPath ? withPmUpdated(safeReturnPath) : '/dashboard?pm=updated'
    const cancelPath = safeReturnPath ? safeReturnPath : '/dashboard'

    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      payment_method_types: ['card'],
      customer: customerId,
      success_url: `${appUrl}${successPath}`,
      cancel_url: `${appUrl}${cancelPath}`,
    })

    res.json({ url: session.url })
  } catch (err: any) { console.error(err); res.status(500).json({ error: err.message || 'server error' }) }
})

// Set the default card (used for future off-session charges)
router.post('/set-default', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { paymentMethodId } = req.body || {}
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    if (!paymentMethodId) return res.status(400).json({ error: 'Missing paymentMethodId' })
    if (!hasStripeKey(process.env.STRIPE_SECRET_KEY)) return res.status(400).json({ error: 'Stripe not configured' })

    const customerId = await getOrCreateCustomerId(userId)
    if (!customerId) return res.status(400).json({ error: 'Stripe not configured' })

    // Ensure the PM is attached to this customer (Stripe will error if it belongs elsewhere)
    try { await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId }) } catch { /* ignore */ }
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } })
    res.json({ ok: true })
  } catch (err: any) { console.error(err); res.status(500).json({ error: err.message || 'server error' }) }
})

// Remove a saved card
router.post('/detach', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { paymentMethodId } = req.body || {}
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    if (!paymentMethodId) return res.status(400).json({ error: 'Missing paymentMethodId' })
    if (!hasStripeKey(process.env.STRIPE_SECRET_KEY)) return res.status(400).json({ error: 'Stripe not configured' })

    const customerId = await getOrCreateCustomerId(userId)
    if (!customerId) return res.status(400).json({ error: 'Stripe not configured' })

    const customer = await stripe.customers.retrieve(customerId)
    const defaultPaymentMethodId = (customer as any)?.invoice_settings?.default_payment_method || null
    if (defaultPaymentMethodId && defaultPaymentMethodId === paymentMethodId) {
      await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: null as any } })
    }

    await stripe.paymentMethods.detach(paymentMethodId)
    res.json({ ok: true })
  } catch (err: any) { console.error(err); res.status(500).json({ error: err.message || 'server error' }) }
})

export default router
