import { and, asc, count, desc, eq, gte, inArray, lt, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { orderItems, orders, products, users, type Order, type OrderItem } from '../../db/schema';
import type { GraphQLContext } from '../../graphql/context';
import { toId } from '../../graphql/base';
import { requireAuth } from '../../lib/auth';
import { badInput, validate } from '../../lib/errors';
import { fromCents } from '../../lib/money';
import { nullToUndefined } from '../../lib/utils';
import * as service from './orders.service';

const orderItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.number().int().min(1).max(999),
  notes: z.string().trim().max(250).optional(),
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'La orden debe tener al menos un producto').max(100),
  customerName: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

const updateItemSchema = z.object({
  quantity: z.number().int().min(0).max(999).optional(),
  notes: z.string().trim().max(250).optional(),
});

const paymentMethodSchema = z.enum(['CASH', 'CARD', 'TRANSFER']);
const statusSchema = z.enum(['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']);

const parseItems = (items: unknown) =>
  validate(
    z.array(orderItemSchema).min(1).max(100),
    (items as Record<string, unknown>[]).map((i) => nullToUndefined(i)),
  );

interface OrderFilterArgs {
  status?: string[] | null;
  paymentStatus?: 'UNPAID' | 'PAID' | 'REFUNDED' | null;
  from?: Date | null;
  to?: Date | null;
  ticketNumber?: number | null;
}

export const ordersResolvers = {
  Query: {
    orders: async (
      _: unknown,
      args: { filter?: OrderFilterArgs | null; limit?: number; offset?: number },
      ctx: GraphQLContext,
    ) => {
      requireAuth(ctx);
      const f = args.filter ?? {};
      const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
      const offset = Math.max(args.offset ?? 0, 0);

      const conditions: SQL[] = [];
      if (f.status?.length) {
        conditions.push(inArray(orders.status, f.status.map((s) => statusSchema.parse(s))));
      }
      if (f.paymentStatus) conditions.push(eq(orders.paymentStatus, f.paymentStatus));
      if (f.from) conditions.push(gte(orders.createdAt, f.from));
      if (f.to) conditions.push(lt(orders.createdAt, f.to));
      if (f.ticketNumber) conditions.push(eq(orders.ticketNumber, f.ticketNumber));
      const where = conditions.length ? and(...conditions) : undefined;

      const [nodes, [{ total }]] = await Promise.all([
        ctx.db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(limit).offset(offset),
        ctx.db.select({ total: count() }).from(orders).where(where),
      ]);
      return { nodes, totalCount: total };
    },

    order: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx);
      return (await ctx.db.query.orders.findFirst({ where: eq(orders.id, toId(args.id)) })) ?? null;
    },

    activeOrders: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAuth(ctx);
      return ctx.db
        .select()
        .from(orders)
        .where(inArray(orders.status, ['PENDING', 'PREPARING', 'READY']))
        .orderBy(asc(orders.createdAt));
    },
  },

  Mutation: {
    createOrder: (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      const raw = nullToUndefined(args.input);
      const input = validate(createOrderSchema, {
        ...raw,
        items: ((raw.items as Record<string, unknown>[]) ?? []).map((i) => nullToUndefined(i)),
      });
      return service.createOrder(ctx.db, user, input);
    },

    addOrderItems: (
      _: unknown,
      args: { orderId: string; items: unknown },
      ctx: GraphQLContext,
    ) => {
      requireAuth(ctx);
      return service.addOrderItems(ctx.db, toId(args.orderId), parseItems(args.items));
    },

    updateOrderItem: (
      _: unknown,
      args: { itemId: string; input: Record<string, unknown> },
      ctx: GraphQLContext,
    ) => {
      requireAuth(ctx);
      const input = validate(updateItemSchema, nullToUndefined(args.input));
      if (input.quantity === undefined && input.notes === undefined) {
        throw badInput('No hay cambios para guardar');
      }
      return service.updateOrderItem(ctx.db, toId(args.itemId), input);
    },

    payOrder: (
      _: unknown,
      args: { orderId: string; method: string; amountPaid?: number | null },
      ctx: GraphQLContext,
    ) => {
      requireAuth(ctx);
      const method = validate(paymentMethodSchema, args.method);
      const amountPaid = args.amountPaid ?? undefined;
      if (amountPaid !== undefined && amountPaid < 0) throw badInput('Monto inválido');
      return service.payOrder(ctx.db, toId(args.orderId), method, amountPaid);
    },

    updateOrderStatus: (
      _: unknown,
      args: { orderId: string; status: string },
      ctx: GraphQLContext,
    ) => {
      requireAuth(ctx);
      return service.updateOrderStatus(ctx.db, toId(args.orderId), validate(statusSchema, args.status));
    },

    cancelOrder: (
      _: unknown,
      args: { orderId: string; reason: string },
      ctx: GraphQLContext,
    ) => {
      const user = requireAuth(ctx);
      const reason = validate(z.string().trim().min(3, 'Indica el motivo').max(500), args.reason);
      return service.cancelOrder(ctx.db, user, toId(args.orderId), reason);
    },
  },

  Order: {
    items: (parent: Order, _: unknown, ctx: GraphQLContext) =>
      ctx.db.query.orderItems.findMany({
        where: eq(orderItems.orderId, parent.id),
        orderBy: asc(orderItems.id),
      }),
    itemCount: async (parent: Order, _: unknown, ctx: GraphQLContext) => {
      const rows = await ctx.db
        .select({ quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, parent.id));
      return rows.reduce((sum, r) => sum + r.quantity, 0);
    },
    subtotal: (p: Order) => fromCents(p.subtotalCents),
    tax: (p: Order) => fromCents(p.taxCents),
    discount: (p: Order) => fromCents(p.discountCents),
    total: (p: Order) => fromCents(p.totalCents),
    amountPaid: (p: Order) => fromCents(p.amountPaidCents),
    change: (p: Order) => fromCents(p.changeCents),
    createdBy: async (parent: Order, _: unknown, ctx: GraphQLContext) =>
      (await ctx.db.query.users.findFirst({ where: eq(users.id, parent.createdById) })) ?? null,
  },

  OrderItem: {
    unitPrice: (p: OrderItem) => fromCents(p.unitPriceCents),
    lineTotal: (p: OrderItem) => fromCents(p.lineTotalCents),
    product: async (parent: OrderItem, _: unknown, ctx: GraphQLContext) =>
      (await ctx.db.query.products.findFirst({ where: eq(products.id, parent.productId) })) ?? null,
  },
};
