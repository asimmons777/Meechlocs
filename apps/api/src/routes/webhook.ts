import express from 'express'
import Stripe from 'stripe'
import { prisma } from '../lib/prisma'
import rawBody from 'raw-body'
import sendgrid from '@sendgrid/mail'

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2022-11-15' } as any)
const hasStripeKey = (k?: string) => !!k && k.length > 20 && !k.includes('...')
if (process.env.SENDGRID_API_KEY) sendgrid.setApiKey(process.env.SENDGRID_API_KEY)

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string | undefined
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  let event: Stripe.Event

  try {
    // If express.raw() middleware already populated req.body, prefer that.
    if (req.body && Object.keys(req.body as any).length > 0) {
      // req.body might be a parsed object or a Buffer
      if (Buffer.isBuffer(req.body)) {
        const buf = req.body as Buffer
        if (webhookSecret && sig) {
          event = stripe.webhooks.constructEvent(buf, sig, webhookSecret)
        } else {
          event = JSON.parse(buf.toString('utf8')) as Stripe.Event
        }
      } else {
        event = req.body as unknown as Stripe.Event
      }
    } else {
      // No body provided by middleware; read raw stream
      const buf = await rawBody(req)
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(buf, sig, webhookSecret)
      } else {
        event = JSON.parse(buf.toString('utf8')) as Stripe.Event
      }
    }
  } catch (err: any) {
    console.error('Webhook error', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const clientRef = session.client_reference_id
    if (clientRef) {
      const appointmentId = Number(clientRef)
      if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
        console.warn('Invalid client_reference_id in webhook:', clientRef)
      } else {
        try {
          await prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'CONFIRMED', stripePaymentIntent: session.payment_intent as string, stripeSessionId: session.id } })
          console.log('Appointment confirmed:', appointmentId)
        } catch (e) {
          console.error('Error updating appointment status in webhook:', e)
        }

        try {
          const ap = await prisma.appointment.findUnique({ where: { id: appointmentId } })
          if (ap && ap.userId && session.payment_intent) {
            if (hasStripeKey(process.env.STRIPE_SECRET_KEY)) {
              try {
                const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string)
                const pm = (pi as any).payment_method as string | undefined
                const user = await prisma.user.findUnique({ where: { id: ap.userId } })
                if (user) {
                  let customerId = user.stripeCustomerId
                  if (!customerId) {
                    const cust = await stripe.customers.create({ email: session.customer_details?.email || user.email })
                    customerId = cust.id
                    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } })
                  }
                  if (pm && customerId) {
                    try {
                      await stripe.paymentMethods.attach(pm, { customer: customerId })
                      await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm } })
                    } catch (e) {
                      console.warn('Could not attach payment method:', e)
                    }
                  }
                }
              } catch (innerErr) {
                console.error('Error retrieving payment intent or attaching method:', innerErr)
              }
            } else {
              console.log('Stripe not configured; skipping payment method attach.')
            }
          }
        } catch (e) { console.error('Error saving stripe customer/payment method', e) }

        // send confirmation email (if SendGrid configured), otherwise log
        try {
          const ap2 = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { service: true, user: true } })
          if (ap2) {
            const emailTo = ap2.user?.email
            const subject = `Booking confirmed: ${ap2.service?.title || ''}`
            const text = `Your booking for ${ap2.service?.title || ''} on ${new Date(ap2.start).toLocaleString()} is confirmed.`
            if (process.env.SENDGRID_API_KEY && emailTo) {
              await sendgrid.send({ to: emailTo, from: process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || 'no-reply@meechlocs.test', subject, text })
            } else {
              console.log('Confirmation email (simulated):', { to: emailTo, subject, text })
            }
          }
        } catch (e) { console.error('Error sending confirmation email', e) }
      }
    }
  }

  res.json({ received: true })
})

export default router

