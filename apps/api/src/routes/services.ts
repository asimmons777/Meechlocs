import express from 'express';
import { prisma } from '../lib/prisma';
import { isDemoService, shouldHideDemoContent } from '../utils/demo';

const router = express.Router();

router.get('/', async (req, res) => {
  const services = await prisma.service.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
  const list = shouldHideDemoContent() ? services.filter(s => !isDemoService(s)) : services;
  res.json(list);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) return res.status(404).json({ error: 'Not found' });
  if (shouldHideDemoContent() && isDemoService(service)) return res.status(404).json({ error: 'Not found' });
  res.json(service);
});

export default router;
