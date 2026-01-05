import jwt from 'jsonwebtoken';
import { Request } from 'express';

export const JWT_SECRET: jwt.Secret = process.env.JWT_SECRET || 'devsecret';

export function signToken(payload: object, expiresIn: jwt.SignOptions['expiresIn'] = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function getTokenFromHeader(req: Request) {
  const auth = req.headers.authorization as string | undefined;
  if (!auth) return null;
  const parts = auth.split(' ');
  if (parts.length !== 2) return null;
  return parts[1];
}
