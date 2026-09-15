import jwt from 'jsonwebtoken';
import { config } from './config';

export interface JwtPayload {
  sub: number;
  username: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as unknown as JwtPayload;
}
