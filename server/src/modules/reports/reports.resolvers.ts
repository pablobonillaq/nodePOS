import { and, desc, eq, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { env } from '../../config/env';
import { orderItems, orders } from '../../db/schema';
import type { GraphQLContext } from '../../graphql/context';
import { requireRole } from '../../lib/auth';
import { fromCents } from '../../lib/money';

interface RangeArgs {
  from?: Date | null;
  to?: Date | null;
}

/**
 * La zona horaria se inserta como literal (validada en env.ts) para que
 * PostgreSQL reconozca la misma expresión en SELECT y GROUP BY.
 */
const tz = () => sql.raw(`'${env.BUSINESS_TIMEZONE}'`);

/** Condición de rango sobre una columna de fecha; por defecto "hoy" en la TZ del negocio. */
function inRange(column: SQLWrapper, { from, to }: RangeArgs): SQL {
  if (!from && !to) {
    return sql`(${column} at time zone ${tz()})::date = (now() at time zone ${tz()})::date`;
  }
  const conditions: SQL[] = [];
  if (from) conditions.push(sql`${column} >= ${from}`);
  if (to) conditions.push(sql`${column} < ${to}`);
  return and(...conditions)!;
}

const paidInRange = (args: RangeArgs) => and(eq(orders.paymentStatus, 'PAID'), inRange(orders.paidAt, args))!;

const sumInt = (col: SQLWrapper) => sql<number>`coalesce(sum(${col}), 0)`.mapWith(Number);
const countInt = () => sql<number>`count(*)`.mapWith(Number);

export const reportsResolvers = {
  Query: {
    salesSummary: async (_: unknown, args: RangeArgs, ctx: GraphQLContext) => {
      requireRole(ctx, 'ADMIN', 'MANAGER');
      const where = paidInRange(args);

      const [[totals], [items], byMethod, [cancelled]] = await Promise.all([
        ctx.db
          .select({ orderCount: countInt(), gross: sumInt(orders.totalCents), tax: sumInt(orders.taxCents) })
          .from(orders)
          .where(where),
        ctx.db
          .select({ itemsSold: sumInt(orderItems.quantity) })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(where),
        ctx.db
          .select({ method: orders.paymentMethod, orderCount: countInt(), total: sumInt(orders.totalCents) })
          .from(orders)
          .where(where)
          .groupBy(orders.paymentMethod),
        ctx.db
          .select({ count: countInt() })
          .from(orders)
          .where(and(eq(orders.status, 'CANCELLED'), inRange(orders.cancelledAt, args))),
      ]);

      return {
        orderCount: totals.orderCount,
        itemsSold: items.itemsSold,
        grossSales: fromCents(totals.gross),
        tax: fromCents(totals.tax),
        netSales: fromCents(totals.gross - totals.tax),
        averageTicket: totals.orderCount ? fromCents(Math.round(totals.gross / totals.orderCount)) : 0,
        cancelledCount: cancelled.count,
        byPaymentMethod: byMethod
          .filter((m) => m.method !== null)
          .map((m) => ({ method: m.method, orderCount: m.orderCount, total: fromCents(m.total) })),
      };
    },

    topProducts: async (
      _: unknown,
      args: RangeArgs & { limit?: number },
      ctx: GraphQLContext,
    ) => {
      requireRole(ctx, 'ADMIN', 'MANAGER');
      const limit = Math.min(Math.max(args.limit ?? 10, 1), 100);
      const quantity = sumInt(orderItems.quantity);
      const rows = await ctx.db
        .select({
          productId: orderItems.productId,
          productName: sql<string>`max(${orderItems.productName})`,
          quantity,
          revenue: sumInt(orderItems.lineTotalCents),
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(paidInRange(args))
        .groupBy(orderItems.productId)
        .orderBy(desc(quantity))
        .limit(limit);
      return rows.map((r) => ({ ...r, revenue: fromCents(r.revenue) }));
    },

    salesByDay: async (_: unknown, args: RangeArgs, ctx: GraphQLContext) => {
      requireRole(ctx, 'ADMIN', 'MANAGER');
      const day = sql<string>`to_char(${orders.paidAt} at time zone ${tz()}, 'YYYY-MM-DD')`;
      const rows = await ctx.db
        .select({ date: day, orderCount: countInt(), total: sumInt(orders.totalCents) })
        .from(orders)
        .where(paidInRange(args))
        .groupBy(day)
        .orderBy(day);
      return rows.map((r) => ({ ...r, total: fromCents(r.total) }));
    },

    salesByHour: async (_: unknown, args: RangeArgs, ctx: GraphQLContext) => {
      requireRole(ctx, 'ADMIN', 'MANAGER');
      const hour = sql<number>`extract(hour from ${orders.paidAt} at time zone ${tz()})::int`.mapWith(Number);
      const rows = await ctx.db
        .select({ hour, orderCount: countInt(), total: sumInt(orders.totalCents) })
        .from(orders)
        .where(paidInRange(args))
        .groupBy(hour)
        .orderBy(hour);
      return rows.map((r) => ({ ...r, total: fromCents(r.total) }));
    },
  },
};
