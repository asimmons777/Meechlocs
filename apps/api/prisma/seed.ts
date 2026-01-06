// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = 'Passw0rd!';
  const passwordHash = await bcrypt.hash(password, 10);

  // create admin if not exists
  const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@meechlocs.test' } });
  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        email: 'admin@meechlocs.test',
        passwordHash,
        name: 'Stylist Admin',
        role: 'ADMIN'
      }
    });
    console.log('Admin created:', admin.email, '(password: Passw0rd!)');
  } else {
    console.log('Admin exists:', existingAdmin.email);
  }

  // demo user
  const existingUser = await prisma.user.findUnique({ where: { email: 'user@meechlocs.test' } });
  if (!existingUser) {
    const user = await prisma.user.create({
      data: {
        email: 'user@meechlocs.test',
        passwordHash,
        name: 'Demo User',
        role: 'USER'
      }
    });
    console.log('Demo user created:', user.email);
  } else {
    console.log('Demo user exists:', existingUser.email);
  }

  // demo services
  const services = [
    {
      title: 'Wash & Style',
      description: 'A professional wash and style.',
      durationMins: 45,
      priceCents: 4000,
      depositCents: 1000,
      images: ['https://via.placeholder.com/400']
    },
    {
      title: 'Color Treatment',
      description: 'Full color treatment.',
      durationMins: 120,
      priceCents: 12000,
      depositCents: 3000,
      images: ['https://via.placeholder.com/400']
    },
    {
      title: 'Cut & Trim',
      description: 'Haircut and trim.',
      durationMins: 60,
      priceCents: 6000,
      depositCents: 1500,
      images: ['https://via.placeholder.com/400']
    }
  ];

  for (const s of services) {
    const existing = await prisma.service.findFirst({ where: { title: s.title } });
    if (!existing) {
      await prisma.service.create({ data: s });
      console.log('Created service:', s.title);
    } else {
      console.log('Service exists:', s.title);
    }
  }

  // default availability (for demo): ensure next 14 days have 09:00-17:00 UTC
  let created = 0;
  for (let i = 1; i <= 14; i++) {
    const day = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
    const y = day.getUTCFullYear();
    const m = String(day.getUTCMonth() + 1).padStart(2, '0');
    const d = String(day.getUTCDate()).padStart(2, '0');
    const start = new Date(`${y}-${m}-${d}T09:00:00.000Z`);
    const end = new Date(`${y}-${m}-${d}T17:00:00.000Z`);

    const exists = await prisma.availability.findFirst({ where: { start, end } });
    if (!exists) {
      await prisma.availability.create({ data: { start, end } });
      created++;
    }
  }
  const availCount = await prisma.availability.count();
  console.log(`Availability blocks: ${availCount} total (${created} created in this run).`);

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
