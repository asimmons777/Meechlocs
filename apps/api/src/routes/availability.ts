import express from 'express'
import { prisma } from '../lib/prisma'

const router = express.Router()

// return raw availability entries
router.get('/', async (req, res) => {
  try {
    const entries = await prisma.availability.findMany({ orderBy: { start: 'asc' } })
    res.json(entries)
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

// return available slots for a given service and date
// query: ?serviceId=1&date=2025-12-24
router.get('/slots', async (req, res) => {
  try {
    const { serviceId, date } = req.query
    if (!serviceId || !date) return res.status(400).json({ error: 'serviceId and date required' })
    const svc = await prisma.service.findUnique({ where: { id: Number(serviceId) } })
    if (!svc) return res.status(400).json({ error: 'service not found' })

    const dayStart = new Date(`${String(date)}T00:00:00.000Z`)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    // find availability that intersects the day
    const avails = await prisma.availability.findMany({ where: { OR: [{ start: { lt: dayEnd }, end: { gt: dayStart } }] } })

    // find appointments for that day
    const appointments = await prisma.appointment.findMany({ where: { OR: [{ start: { gte: dayStart, lt: dayEnd } }, { end: { gt: dayStart, lte: dayEnd } }] } })

    const slots: string[] = []
    const slotMs = svc.durationMins * 60 * 1000

    for (const a of avails) {
      // compute overlap with day
      const start = a.start < dayStart ? dayStart : a.start
      const end = a.end > dayEnd ? dayEnd : a.end
      for (let t = start.getTime(); t + slotMs <= end.getTime(); t += slotMs) {
        const slotStart = new Date(t)
        const slotEnd = new Date(t + slotMs)
        // check overlap with appointments
        const conflict = appointments.some(ap => !(ap.end <= slotStart || ap.start >= slotEnd) )
        if (!conflict) slots.push(slotStart.toISOString())
      }
    }

    res.json({ slots })
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }) }
})

export default router
