import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import type { UserRole } from '../db/schema';
import type { GraphQLContext } from '../graphql/context';
import { forbidden, passwordChangeRequired, unauthenticated } from './errors';

/** Usuario autenticado (se carga de la BD en cada request). */
export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  /** Tiene contraseña temporal: solo puede cambiarla */
  mustChangePassword: boolean;
}

interface TokenPayload {
  sub: string;
  /** Debe coincidir con users.token_version; si no, el token está revocado */
  ver: number;
}

/** Horas de validez de una contraseña temporal. */
export const TEMP_PASSWORD_TTL_HOURS = 24;

/** Política de contraseñas elegidas por el usuario. */
export const newPasswordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(100)
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
  .regex(/[0-9]/, 'La contraseña debe incluir al menos un número');

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/**
 * Genera una contraseña temporal legible, ej. "K7PM-W3XQ".
 * Sin caracteres ambiguos (0/O, 1/I/L) para dictarla o escribirla sin errores.
 */
export function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const pick = () => alphabet[randomInt(alphabet.length)];
  const block = () => Array.from({ length: 4 }, pick).join('');
  return `${block()}-${block()}`;
}

export function signToken(user: { id: number; tokenVersion: number }): string {
  const payload: TokenPayload = { sub: String(user.id), ver: user.tokenVersion };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

/** Valida firma/expiración del header `Authorization: Bearer <token>`. */
export function tokenFromAuthHeader(
  header: string | null | undefined,
): { id: number; ver: number } | null {
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.slice('Bearer '.length).trim(), env.JWT_SECRET) as TokenPayload;
    if (typeof decoded.ver !== 'number') return null; // tokens con formato antiguo
    return { id: Number(decoded.sub), ver: decoded.ver };
  } catch {
    return null;
  }
}

// ─── Guards para resolvers ───────────────────────────────────────────────────
interface AuthOptions {
  /** Permitir el acceso aunque el usuario tenga una contraseña temporal pendiente */
  allowPendingPasswordChange?: boolean;
}

export function requireAuth(ctx: GraphQLContext, options: AuthOptions = {}): AuthUser {
  if (!ctx.user) throw unauthenticated();
  if (ctx.user.mustChangePassword && !options.allowPendingPasswordChange) {
    throw passwordChangeRequired();
  }
  return ctx.user;
}

export function requireRole(ctx: GraphQLContext, ...roles: UserRole[]): AuthUser {
  const user = requireAuth(ctx);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}
