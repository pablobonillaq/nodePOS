import { and, asc, eq, ilike, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { categories, products, type Category, type Product } from '../../db/schema';
import type { GraphQLContext } from '../../graphql/context';
import { toId } from '../../graphql/base';
import { requireAuth, requireRole } from '../../lib/auth';
import { badInput, conflict, isUniqueViolation, notFound, validate } from '../../lib/errors';
import { fromCents, toCents } from '../../lib/money';
import { compact, nullToUndefined } from '../../lib/utils';

const hexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color hex inválido');
const optionalId = z.coerce.number().int().positive().optional();

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  color: hexColor.optional(),
  sortOrder: z.number().int().optional(),
});
const updateCategorySchema = createCategorySchema.partial().extend({ active: z.boolean().optional() });

const createProductSchema = z.object({
  name: z.string().trim().min(1).max(120),
  price: z.number().nonnegative().max(1_000_000),
  categoryId: optionalId,
  description: z.string().trim().max(1000).optional(),
  sku: z.string().trim().min(1).max(40).optional(),
  imageUrl: z.string().url().optional(),
  available: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
const updateProductSchema = createProductSchema.partial().extend({ active: z.boolean().optional() });

type Args<T = Record<string, unknown>> = T;

async function ensureCategoryExists(ctx: GraphQLContext, categoryId?: number) {
  if (categoryId === undefined) return;
  const cat = await ctx.db.query.categories.findFirst({ where: eq(categories.id, categoryId) });
  if (!cat) throw badInput(`La categoría #${categoryId} no existe`);
}

function handleUnique(err: unknown, message: string): never {
  if (isUniqueViolation(err)) throw conflict(message);
  throw err;
}

export const catalogResolvers = {
  Query: {
    categories: (_: unknown, args: Args<{ includeInactive?: boolean }>, ctx: GraphQLContext) => {
      requireAuth(ctx);
      return ctx.db.query.categories.findMany({
        where: args.includeInactive ? undefined : eq(categories.active, true),
        orderBy: [asc(categories.sortOrder), asc(categories.name)],
      });
    },

    category: async (_: unknown, args: Args<{ id: string }>, ctx: GraphQLContext) => {
      requireAuth(ctx);
      return (
        (await ctx.db.query.categories.findFirst({ where: eq(categories.id, toId(args.id)) })) ?? null
      );
    },

    products: (
      _: unknown,
      args: Args<{
        filter?: {
          categoryId?: string;
          search?: string;
          onlyAvailable?: boolean;
          includeInactive?: boolean;
        } | null;
      }>,
      ctx: GraphQLContext,
    ) => {
      requireAuth(ctx);
      const f = args.filter ?? {};
      const conditions: SQL[] = [];
      if (!f.includeInactive) conditions.push(eq(products.active, true));
      if (f.onlyAvailable) conditions.push(eq(products.available, true));
      if (f.categoryId) conditions.push(eq(products.categoryId, toId(f.categoryId)));
      if (f.search?.trim()) conditions.push(ilike(products.name, `%${f.search.trim()}%`));

      return ctx.db.query.products.findMany({
        where: conditions.length ? and(...conditions) : undefined,
        with: { category: true },
        orderBy: [asc(products.sortOrder), asc(products.name)],
      });
    },

    product: async (_: unknown, args: Args<{ id: string }>, ctx: GraphQLContext) => {
      requireAuth(ctx);
      return (
        (await ctx.db.query.products.findFirst({
          where: eq(products.id, toId(args.id)),
          with: { category: true },
        })) ?? null
      );
    },
  },

  Mutation: {
    createCategory: async (_: unknown, args: Args<{ input: unknown }>, ctx: GraphQLContext) => {
      requireRole(ctx, 'ADMIN', 'MANAGER');
      const input = validate(createCategorySchema, nullToUndefined(args.input as Record<string, unknown>));
      try {
        const [created] = await ctx.db.insert(categories).values(input).returning();
        return created;
      } catch (err) {
        handleUnique(err, `Ya existe una categoría llamada "${input.name}"`);
      }
    },

    updateCategory: async (
      _: unknown,
      args: Args<{ id: string; input: unknown }>,
      ctx: GraphQLContext,
    ) => {
      requireRole(ctx, 'ADMIN', 'MANAGER');
      const id = toId(args.id);
      const input = compact(
        validate(updateCategorySchema, nullToUndefined(args.input as Record<string, unknown>)),
      );
      if (Object.keys(input).length === 0) throw badInput('No hay cambios para guardar');
      try {
        const [updated] = await ctx.db
          .update(categories)
          .set(input)
          .where(eq(categories.id, id))
          .returning();
        if (!updated) throw notFound('Categoría', id);
        return updated;
      } catch (err) {
        handleUnique(err, 'Ya existe una categoría con ese nombre');
      }
    },

    deleteCategory: async (_: unknown, args: Args<{ id: string }>, ctx: GraphQLContext) => {
      requireRole(ctx, 'ADMIN', 'MANAGER');
      const id = toId(args.id);
      const [row] = await ctx.db
        .update(categories)
        .set({ active: false })
        .where(eq(categories.id, id))
        .returning({ id: categories.id });
      if (!row) throw notFound('Categoría', id);
      return true;
    },

    createProduct: async (_: unknown, args: Args<{ input: unknown }>, ctx: GraphQLContext) => {
      requireRole(ctx, 'ADMIN', 'MANAGER');
      const { price, ...input } = validate(
        createProductSchema,
        nullToUndefined(args.input as Record<string, unknown>),
      );
      await ensureCategoryExists(ctx, input.categoryId);
      try {
        const [created] = await ctx.db
          .insert(products)
          .values({ ...input, priceCents: toCents(price) })
          .returning();
        return created;
      } catch (err) {
        handleUnique(err, `El SKU "${input.sku}" ya está en uso`);
      }
    },

    updateProduct: async (
      _: unknown,
      args: Args<{ id: string; input: unknown }>,
      ctx: GraphQLContext,
    ) => {
      requireRole(ctx, 'ADMIN', 'MANAGER');
      const id = toId(args.id);
      const { price, ...input } = validate(
        updateProductSchema,
        nullToUndefined(args.input as Record<string, unknown>),
      );
      await ensureCategoryExists(ctx, input.categoryId);
      const changes = compact({ ...input, priceCents: price !== undefined ? toCents(price) : undefined });
      if (Object.keys(changes).length === 0) throw badInput('No hay cambios para guardar');
      try {
        const [updated] = await ctx.db
          .update(products)
          .set(changes)
          .where(eq(products.id, id))
          .returning();
        if (!updated) throw notFound('Producto', id);
        return updated;
      } catch (err) {
        handleUnique(err, 'El SKU ya está en uso');
      }
    },

    setProductAvailability: async (
      _: unknown,
      args: Args<{ id: string; available: boolean }>,
      ctx: GraphQLContext,
    ) => {
      requireAuth(ctx);
      const id = toId(args.id);
      const [updated] = await ctx.db
        .update(products)
        .set({ available: args.available })
        .where(eq(products.id, id))
        .returning();
      if (!updated) throw notFound('Producto', id);
      return updated;
    },

    deleteProduct: async (_: unknown, args: Args<{ id: string }>, ctx: GraphQLContext) => {
      requireRole(ctx, 'ADMIN', 'MANAGER');
      const id = toId(args.id);
      const [row] = await ctx.db
        .update(products)
        .set({ active: false })
        .where(eq(products.id, id))
        .returning({ id: products.id });
      if (!row) throw notFound('Producto', id);
      return true;
    },
  },

  Category: {
    products: (parent: Category, args: Args<{ onlyAvailable?: boolean }>, ctx: GraphQLContext) => {
      const conditions: SQL[] = [eq(products.categoryId, parent.id), eq(products.active, true)];
      if (args.onlyAvailable) conditions.push(eq(products.available, true));
      return ctx.db.query.products.findMany({
        where: and(...conditions),
        orderBy: [asc(products.sortOrder), asc(products.name)],
      });
    },
  },

  Product: {
    price: (parent: Product) => fromCents(parent.priceCents),
    category: async (parent: Product & { category?: Category | null }, _: unknown, ctx: GraphQLContext) => {
      if (parent.category !== undefined) return parent.category;
      if (!parent.categoryId) return null;
      return (
        (await ctx.db.query.categories.findFirst({ where: eq(categories.id, parent.categoryId) })) ?? null
      );
    },
  },
};
