import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()
import authRoutes from './routes/auth'
import servicesRoutes from './routes/services'
import appointmentsRoutes from './routes/appointments'
import webhook from './routes/webhook'
import adminRoutes from './routes/admin'
import availabilityRoutes from './routes/availability'
import paymentsRoutes from './routes/payments'
import path from 'path'
import fs from 'fs'

const app = express()

const corsOriginEnv = (process.env.CORS_ORIGIN || '').trim()
if (corsOriginEnv && corsOriginEnv !== '*') {
  const origins = corsOriginEnv.split(',').map(o => o.trim()).filter(Boolean)
  app.use(cors({ origin: origins, credentials: true }))
} else {
  if ((process.env.NODE_ENV || '').trim() === 'production' && corsOriginEnv === '*') {
    console.warn("[api] WARN: CORS_ORIGIN='*' in production. Set CORS_ORIGIN to your Vercel/custom domain for a production-safe deploy.")
  }
  app.use(cors())
}

// stripe webhook - must receive raw body for signature verification
app.use('/api/webhook', express.raw({ type: 'application/json' }), webhook)

// JSON body parser for all other routes
app.use(express.json())

// Static uploads (used for service/gallery images)
const uploadDir = (process.env.UPLOAD_DIR && process.env.UPLOAD_DIR.trim())
  ? process.env.UPLOAD_DIR.trim()
  : path.join(process.cwd(), 'uploads')
try { fs.mkdirSync(uploadDir, { recursive: true }) } catch { /* ignore */ }
app.use('/uploads', express.static(uploadDir))

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/services', servicesRoutes)
app.use('/api/appointments', appointmentsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/availability', availabilityRoutes)
app.use('/api/payments', paymentsRoutes)

// health
app.get('/api/health', (req, res) => {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim()
  const stripeConfigured = !!key && key.length > 20 && !key.includes('...')
  const appUrlPresent = !!(process.env.APP_URL || '').trim()
  res.json({ ok: true, stripeConfigured, appUrlPresent, nodeEnv: (process.env.NODE_ENV || '').trim() || 'unknown' })
})

const port = Number(process.env.PORT || 4000)
app.listen(port, () => {
  console.log('API listening on port', port)
})
