import express from 'express'
import { prisma } from '../lib/prisma'
import Stripe from 'stripe'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2022-11-15' } as any)
const hasStripeKey = (k?: string) => !!k && k.length > 20 && !k.includes('...')

async function getOrCreateCustomerId(userId: number, email?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (user.stripeCustomerId) return user.stripeCustomerId
  const cust = await stripe.customers.create({ email: email || user.email })
  await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: cust.id } })
  return cust.id
}

// Create appointment (authenticated)
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { serviceId, start, end, paymentMethodId } = req.body
    const userId = req.user?.id
    if (!userId || !serviceId || !start || !end) return res.status(400).json({ error: 'Missing fields' })

    const overlapping = await prisma.appointment.findFirst({
      where: {
        OR: [
          { AND: [{ start: { lte: new Date(start) } }, { end: { gt: new Date(start) } }] },
          { AND: [{ start: { lt: new Date(end) } }, { end: { gte: new Date(end) } }] },
          { AND: [{ start: { gte: new Date(start) } }, { end: { lte: new Date(end) } }] }
        ],
        status: { notIn: ['CANCELED', 'REFUNDED'] }
      }
    })

    if (overlapping) return res.status(400).json({ error: 'Time slot is not available' })

    const appointment = await prisma.appointment.create({ data: { userId, serviceId, start: new Date(start), end: new Date(end), status: 'PENDING' } })

    const service = await prisma.service.findUnique({ where: { id: Number(serviceId) } })
    if (!service) return res.status(400).json({ error: 'Service not found' })

    // If deposits are enabled for this service, Stripe must be configured.
    // Otherwise the UI will look like it "confirmed" without collecting payment.
    if ((service.depositCents || 0) > 0 && !hasStripeKey(process.env.STRIPE_SECRET_KEY)) {
      return res.status(400).json({ error: 'Stripe not configured' })
    }

    if (hasStripeKey(process.env.STRIPE_SECRET_KEY)) {
      const appUrl = process.env.APP_URL || 'http://localhost:5173'
      const customerId = await getOrCreateCustomerId(userId, req.user?.email)

      // If the user selected a saved payment method, attempt to pay immediately (no redirect).
      if (paymentMethodId) {
        try {
          // Ensure method is attached to this customer (ignore if already attached)
          try { await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId }) } catch { /* ignore */ }
          await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } })

          const pi = await stripe.paymentIntents.create({
            amount: service.depositCents,
            currency: 'usd',
            customer: customerId,
            payment_method: paymentMethodId,
            confirm: true,
            off_session: true,
            description: `Deposit for appointment ${appointment.id}`,
            metadata: { appointmentId: String(appointment.id) },
          })

          if (pi.status === 'succeeded') {
            const updated = await prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CONFIRMED', stripePaymentIntent: pi.id } })
            return res.json({ appointment: updated })
          }
        } catch (e) {
          // If saved-card charge fails (SCA required, declined, etc.), fall back to Checkout.
          console.warn('Saved-card charge failed; falling back to checkout:', e)
        }
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price_data: { currency: 'usd', product_data: { name: service.title, description: service.description || undefined }, unit_amount: service.depositCents }, quantity: 1 }],
        client_reference_id: String(appointment.id),
        success_url: `${appUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/booking/cancel`,
        customer: customerId,
        payment_intent_data: { setup_future_usage: 'off_session' }
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

// Cancel an appointment (authenticated, owner-only)
router.post('/:id/cancel', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const id = Number(req.params.id)
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid appointment id' })

    const appt = await prisma.appointment.findUnique({ where: { id }, include: { service: true } })
    if (!appt) return res.status(404).json({ error: 'Not found' })
    if (appt.userId !== userId) return res.status(403).json({ error: 'Forbidden' })

    if (appt.status === 'CANCELED') return res.json({ ok: true, appointment: appt, depositForfeited: false, refunded: false })
    if (appt.status === 'REFUNDED') return res.json({ ok: true, appointment: appt, depositForfeited: false, refunded: true })
    if (appt.status === 'COMPLETED') return res.status(400).json({ error: `Cannot cancel an appointment in status ${appt.status}` })

    const now = Date.now()
    const startMs = new Date(appt.start).getTime()
    if (!Number.isFinite(startMs)) return res.status(400).json({ error: 'Invalid appointment start time' })
    if (startMs <= now) return res.status(400).json({ error: 'Cannot cancel a past appointment' })

    const hoursUntil = (startMs - now) / (60 * 60 * 1000)
    const depositForfeited = hoursUntil <= 24

    // Within 24 hours: cancel, no refund (deposit forfeited).
    if (depositForfeited) {
      const updated = await prisma.appointment.update({ where: { id }, data: { status: 'CANCELED' } })
      return res.json({ ok: true, appointment: updated, depositForfeited: true, refunded: false, hoursUntilStart: hoursUntil })
    }

    // More than 24 hours: automatically refund if there was a payment.
    if (!appt.stripePaymentIntent) {
      const updated = await prisma.appointment.update({ where: { id }, data: { status: 'CANCELED' } })
      return res.json({ ok: true, appointment: updated, depositForfeited: false, refunded: false, hoursUntilStart: hoursUntil })
    }

    // If Stripe isn't configured in this environment, simulate the refund but mark REFUNDED.
    if (!hasStripeKey(process.env.STRIPE_SECRET_KEY)) {
      const simulatedAmountCents = appt.service?.depositCents ? Number(appt.service.depositCents) : null
      const updated = await prisma.appointment.update({ where: { id }, data: { status: 'REFUNDED' } })
      return res.json({
        ok: true,
        appointment: updated,
        depositForfeited: false,
        refunded: true,
        refundSimulated: true,
        refundedAmountCents: simulatedAmountCents,
        hoursUntilStart: hoursUntil,
      })
    }

    // Real Stripe refund (deposit only).
    const pi = await stripe.paymentIntents.retrieve(appt.stripePaymentIntent)
    const maxRefundable = (typeof pi.amount_received === 'number' && pi.amount_received > 0) ? pi.amount_received : pi.amount

    if (!maxRefundable || maxRefundable <= 0) {
      const updated = await prisma.appointment.update({ where: { id }, data: { status: 'CANCELED' } })
      return res.json({ ok: true, appointment: updated, depositForfeited: false, refunded: false, hoursUntilStart: hoursUntil })
    }

    const depositCents = appt.service?.depositCents ? Number(appt.service.depositCents) : null
    const desiredRefund = (depositCents != null && Number.isFinite(depositCents) && depositCents > 0)
      ? Math.min(depositCents, maxRefundable)
      : maxRefundable

    const refund = await stripe.refunds.create({ payment_intent: appt.stripePaymentIntent, amount: desiredRefund })
    const updated = await prisma.appointment.update({ where: { id }, data: { status: 'REFUNDED' } })
    return res.json({
      ok: true,
      appointment: updated,
      depositForfeited: false,
      refunded: true,
      refundId: refund.id,
      refundedAmountCents: refund.amount,
      hoursUntilStart: hoursUntil,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

export default router

