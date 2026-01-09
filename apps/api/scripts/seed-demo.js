#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    console.log('[seed-demo] Adding demo services and availability if missing')

    const demoServices = [
      { title: 'Wash & Style', description: 'Shampoo and style', durationMins: 60, priceCents: 5000, depositCents: 1000 },
      { title: 'Cut & Trim', description: 'Haircut and tidy up', durationMins: 45, priceCents: 3500, depositCents: 500 },
      { title: 'Color Treatment', description: 'Color services and consultation', durationMins: 120, priceCents: 12000, depositCents: 3000 },
    ]

    for (const svc of demoServices) {
      const exists = await prisma.service.findFirst({ where: { title: svc.title } })
      if (exists) {
        console.log('[seed-demo] service exists:', svc.title)
        continue
      }
      await prisma.service.create({ data: svc })
      console.log('[seed-demo] created service:', svc.title)
    }

    // Add a few availability slots for the next 7 days (9am, 11am, 2pm)
    const now = new Date()
    for (let d = 0; d < 7; d++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d)
      const slots = [9, 11, 14]
      for (const hour of slots) {
        const start = new Date(day)
        start.setHours(hour, 0, 0, 0)
        const end = new Date(start)
        end.setHours(start.getHours() + 1)

        // Avoid creating duplicate identical availability
        const exists = await prisma.availability.findFirst({ where: { start, end } })
        if (!exists) {
          await prisma.availability.create({ data: { start, end } })
          console.log('[seed-demo] created availability:', start.toISOString())
        }
      }
    }

    console.log('[seed-demo] Done')
  } catch (err) {
    console.error('[seed-demo] Error', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
