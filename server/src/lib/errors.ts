import { GraphQLError } from 'graphql';
import { ZodError } from 'zod';

/**
 * Errores con `extensions.code` para que el cliente (tablet) pueda
 * reaccionar según el tipo de error.
 */
export const unauthenticated = (message = 'No autenticado') =>
  new GraphQLError(message, { extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } } });

export const forbidden = (message = 'No tienes permisos para esta acción') =>
  new GraphQLError(message, { extensions: { code: 'FORBIDDEN', http: { status: 403 } } });

/** El usuario tiene una contraseña temporal y debe cambiarla antes de usar la app. */
export const passwordChangeRequired = () =>
  new GraphQLError('Debes cambiar tu contraseña temporal antes de continuar', {
    extensions: { code: 'PASSWORD_CHANGE_REQUIRED', http: { status: 403 } },
  });

export const notFound =(entity: string, id?: number | string) =>
  new GraphQLError(`${entity}${id !== undefined ? ` #${id}` : ''} no encontrado`, {
    extensions: { code: 'NOT_FOUND' },
  });

export const badInput = (message: string, details?: unknown) =>
  new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT', details } });

export const conflict = (message: string) =>
  new GraphQLError(message, { extensions: { code: 'CONFLICT' } });

/** Valida `data` con un esquema zod y lanza BAD_USER_INPUT si falla. */
export function validate<T>(schema: { parse: (d: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      throw badInput('Datos inválidos', err.flatten().fieldErrors);
    }
    throw err;
  }
}

/** Detecta violación de unicidad de PostgreSQL (código 23505). */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}
