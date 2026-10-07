import { eq } from 'drizzle-orm';
import type { YogaInitialContext } from 'graphql-yoga';
import { db, type DB } from '../db/client';
import { users } from '../db/schema';
import { tokenFromAuthHeader, type AuthUser } from '../lib/auth';

export interface GraphQLContext {
  db: DB;
  user: AuthUser | null;
}

/**
 * Carga el usuario desde la BD en cada request. Así un usuario desactivado,
 * con contraseña restablecida o con el rol cambiado pierde el acceso de inmediato
 * (su `token_version` ya no coincide o `active` es false).
 */
export async function createContext({ request }: YogaInitialContext): Promise<GraphQLContext> {
  const token = tokenFromAuthHeader(request.headers.get('authorization'));
  let user: AuthUser | null = null;

  if (token) {
    const row = await db.query.users.findFirst({
      where: eq(users.id, token.id),
      columns: {
        id: true,
        username: true,
        role: true,
        active: true,
        tokenVersion: true,
        mustChangePassword: true,
      },
    });
    if (row && row.active && row.tokenVersion === token.ver) {
      user = {
        id: row.id,
        username: row.username,
        role: row.role,
        mustChangePassword: row.mustChangePassword,
      };
    }
  }

  return { db, user };
}
