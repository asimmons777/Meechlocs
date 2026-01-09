#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const DEFAULT_EMAIL = 'user@meechlocs.test'
const DEFAULT_PASSWORD = 'Passw0rd!'

async function main() {
  const prisma = new PrismaClient()
  try {
    const email = String(process.env.DEMO_USER_EMAIL || DEFAULT_EMAIL).trim()
    const password = String(process.env.DEMO_USER_PASSWORD || DEFAULT_PASSWORD)

    if (!email || !password) {
      throw new Error('Missing DEMO_USER_EMAIL/DEMO_USER_PASSWORD')
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      console.log('[seed-demo-user] Demo user already exists:', email)
      return
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: 'Demo User',
        role: 'USER',
        verifiedAt: new Date(),
        isGuest: false,
      },
    })

    console.log('[seed-demo-user] Created demo user:', email)
    console.log('[seed-demo-user] Password:', password)
  } catch (err) {
    console.error('[seed-demo-user] Error', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
