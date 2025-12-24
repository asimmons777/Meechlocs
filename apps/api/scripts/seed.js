const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

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
