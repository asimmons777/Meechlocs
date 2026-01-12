// @ts-nocheck
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim()
  const adminPassword = String(process.env.ADMIN_PASSWORD || '')
  const adminName = (process.env.ADMIN_NAME || '').trim() || 'Admin'

  if (!adminEmail || !adminPassword) {
    console.log('Seed: no changes. Set ADMIN_EMAIL and ADMIN_PASSWORD to create the initial admin user.')
    console.log('Tip: run with NODE_ENV=production and a 12+ char password for a real deployment.')
    return
  }

  const env = String(process.env.NODE_ENV || '').toLowerCase()
  if (env === 'production' && adminPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters when NODE_ENV=production')
  }

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })

  const passwordHash = await bcrypt.hash(adminPassword, 10)

  if (!existing) {
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: adminName,
        role: 'ADMIN',
        verifiedAt: new Date(),
      },
    })
    console.log('Admin created:', admin.email)
    console.log('Seed complete')
    return
  }

  const updated = await prisma.user.update({
    where: { email: adminEmail },
    data: {
      passwordHash,
      name: existing.name || adminName,
      role: 'ADMIN',
      verifiedAt: existing.verifiedAt || new Date(),
    },
  })
  console.log('Admin updated:', updated.email)
  console.log('Seed complete')
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
