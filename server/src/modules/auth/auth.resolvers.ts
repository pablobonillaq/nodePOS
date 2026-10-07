import { asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { users } from '../../db/schema';
import type { GraphQLContext } from '../../graphql/context';
import { toId } from '../../graphql/base';
import {
  generateTemporaryPassword,
  hashPassword,
  newPasswordSchema,
  requireAuth,
  requireRole,
  signToken,
  TEMP_PASSWORD_TTL_HOURS,
  verifyPassword,
} from '../../lib/auth';
import {
  badInput,
  conflict,
  isUniqueViolation,
  notFound,
  unauthenticated,
  validate,
} from '../../lib/errors';
import { compact, nullToUndefined } from '../../lib/utils';

const roleSchema = z.enum(['ADMIN', 'MANAGER', 'CASHIER']);

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9._-]+$/, 'Solo letras, números, punto, guion y guion bajo'),
  role: roleSchema.default('CASHIER'),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
});

/** Datos para una contraseña temporal nueva (se guarda solo el hash). */
async function temporaryPassword() {
  const plain = generateTemporaryPassword();
  const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_HOURS * 60 * 60 * 1000);
  return { plain, expiresAt, passwordHash: await hashPassword(plain) };
}

export const authResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.user) return null;
      return (await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.user.id) })) ?? null;
    },

    users: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireRole(ctx, 'ADMIN');
      return ctx.db.query.users.findMany({ orderBy: [desc(users.active), asc(users.name)] });
    },
  },

  Mutation: {
    login: async (
      _: unknown,
      args: { username: string; password: string },
      ctx: GraphQLContext,
    ) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.username, args.username.trim().toLowerCase()),
      });
      if (!user || !user.active || !(await verifyPassword(args.password, user.passwordHash))) {
        throw unauthenticated('Usuario o contraseña incorrectos');
      }
      if (
        user.mustChangePassword &&
        user.tempPasswordExpiresAt &&
        user.tempPasswordExpiresAt.getTime() < Date.now()
      ) {
        throw unauthenticated(
          'Tu contraseña temporal venció. Pide al administrador que la restablezca.',
        );
      }
      const [updated] = await ctx.db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      // Si mustChangePassword es true, el token solo sirve para `me` y `changePassword`
      return { token: signToken(updated), user: updated };
    },

    changePassword: async (
      _: unknown,
      args: { currentPassword: string; newPassword: string },
      ctx: GraphQLContext,
    ) => {
      const actor = requireAuth(ctx, { allowPendingPasswordChange: true });
      const newPassword = validate(newPasswordSchema, args.newPassword);

      const user = await ctx.db.query.users.findFirst({ where: eq(users.id, actor.id) });
      if (!user) throw unauthenticated();
      if (!(await verifyPassword(args.currentPassword, user.passwordHash))) {
        throw badInput('La contraseña actual es incorrecta');
      }
      if (await verifyPassword(newPassword, user.passwordHash)) {
        throw badInput('La nueva contraseña debe ser diferente a la actual');
      }

      const [updated] = await ctx.db
        .update(users)
        .set({
          passwordHash: await hashPassword(newPassword),
          mustChangePassword: false,
          tempPasswordExpiresAt: null,
          passwordChangedAt: new Date(),
          // Invalida cualquier otra sesión abierta con la contraseña anterior
          tokenVersion: sql`${users.tokenVersion} + 1`,
        })
        .where(eq(users.id, user.id))
        .returning();
      return { token: signToken(updated), user: updated };
    },

    createUser: async (_: unknown, args: { input: unknown }, ctx: GraphQLContext) => {
      requireRole(ctx, 'ADMIN');
      const input = validate(createUserSchema, nullToUndefined(args.input as Record<string, unknown>));
      const temp = await temporaryPassword();
      try {
        const [created] = await ctx.db
          .insert(users)
          .values({
            name: input.name,
            username: input.username,
            role: input.role,
            passwordHash: temp.passwordHash,
            mustChangePassword: true,
            tempPasswordExpiresAt: temp.expiresAt,
          })
          .returning();
        return { user: created, temporaryPassword: temp.plain, expiresAt: temp.expiresAt };
      } catch (err) {
        if (isUniqueViolation(err)) throw conflict(`El usuario "${input.username}" ya existe`);
        throw err;
      }
    },

    updateUser: async (_: unknown, args: { id: string; input: unknown }, ctx: GraphQLContext) => {
      const actor = requireRole(ctx, 'ADMIN');
      const id = toId(args.id);
      const input = compact(
        validate(updateUserSchema, nullToUndefined(args.input as Record<string, unknown>)),
      );

      if (id === actor.id && (input.active === false || (input.role && input.role !== 'ADMIN'))) {
        throw conflict('No puedes desactivarte ni quitarte el rol ADMIN a ti mismo');
      }

      const current = await ctx.db.query.users.findFirst({ where: eq(users.id, id) });
      if (!current) throw notFound('Usuario', id);
      if (Object.keys(input).length === 0) return current;

      const [updated] = await ctx.db
        .update(users)
        .set({
          ...input,
          // Desactivar cierra todas sus sesiones al instante
          ...(input.active === false ? { tokenVersion: sql`${users.tokenVersion} + 1` } : {}),
        })
        .where(eq(users.id, id))
        .returning();
      return updated;
    },

    resetUserPassword: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const actor = requireRole(ctx, 'ADMIN');
      const id = toId(args.id);
      if (id === actor.id) {
        throw conflict('Para cambiar tu propia contraseña usa "Cambiar contraseña"');
      }
      const temp = await temporaryPassword();
      const [updated] = await ctx.db
        .update(users)
        .set({
          passwordHash: temp.passwordHash,
          mustChangePassword: true,
          tempPasswordExpiresAt: temp.expiresAt,
          tokenVersion: sql`${users.tokenVersion} + 1`,
        })
        .where(eq(users.id, id))
        .returning();
      if (!updated) throw notFound('Usuario', id);
      return { user: updated, temporaryPassword: temp.plain, expiresAt: temp.expiresAt };
    },
  },
};
