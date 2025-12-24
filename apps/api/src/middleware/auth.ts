import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret'

export interface AuthRequest extends Request {
  user?: any
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'Missing authorization header' })
  const parts = auth.split(' ')
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid authorization header' })
  const token = parts[1]
  try {
    const payload: any = jwt.verify(token, JWT_SECRET)
    if (!payload || !payload.userId) return res.status(401).json({ error: 'Invalid token' })
    const user = await prisma.user.findUnique({ where: { id: Number(payload.userId) } })
    if (!user) return res.status(401).json({ error: 'User not found' })
    req.user = user
    return next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin required' })
  return next()
}
