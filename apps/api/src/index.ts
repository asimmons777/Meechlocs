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
  app.use(cors())
}
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

// stripe webhook - note: when using constructEvent, you must use raw body
app.use('/api/webhook', express.raw({ type: 'application/json' }), webhook)

// health
app.get('/api/health', (req, res) => res.json({ ok: true }))

const port = Number(process.env.PORT || 4000)
app.listen(port, () => {
  console.log('API listening on port', port)
})
