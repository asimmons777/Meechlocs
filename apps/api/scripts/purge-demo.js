require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const configuredAdminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const demoEmails = ['admin@meechlocs.test', 'user@meechlocs.test']
    .map((e) => e.toLowerCase())
    .filter((e) => e && e !== configuredAdminEmail)
  const demoServiceTitles = ['Wash & Style', 'Color Treatment', 'Cut & Trim']

  const demoServices = await prisma.service.findMany({
    where: { title: { in: demoServiceTitles } },
    select: { id: true },
  })
  const demoServiceIds = demoServices.map(s => s.id)

  const demoUsers = await prisma.user.findMany({
    where: { email: { in: demoEmails } },
    select: { id: true },
  })
  const demoUserIds = demoUsers.map(u => u.id)

  const deletedAppointments = await prisma.appointment.deleteMany({
    where: {
      OR: [
        ...(demoServiceIds.length ? [{ serviceId: { in: demoServiceIds } }] : []),
        ...(demoUserIds.length ? [{ userId: { in: demoUserIds } }] : []),
      ],
    },
  })

  const deletedServices = await prisma.service.deleteMany({
    where: { title: { in: demoServiceTitles } },
  })

  const deletedRegCodes = await prisma.registrationCode.deleteMany({
    where: { email: { in: demoEmails } },
  })

  // Delete demo users last (in case FK constraints require removing dependent rows first).
  // Appointments are optional relations, but this keeps the intent clear.
  const deletedUsers = await prisma.user.deleteMany({
    where: { email: { in: demoEmails } },
  })

  console.log('Purged demo content:', {
    deletedAppointments: deletedAppointments.count,
    deletedServices: deletedServices.count,
    deletedRegistrationCodes: deletedRegCodes.count,
    deletedUsers: deletedUsers.count,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
