import { eq, inArray, sql } from 'drizzle-orm';
import { env } from '../../config/env';
import type { DB, Tx } from '../../db/client';
import {
  orderItems,
  orders,
  products,
  type Order,
  type OrderStatus,
  type PaymentMethod,
} from '../../db/schema';
import type { AuthUser } from '../../lib/auth';
import { badInput, conflict, forbidden, notFound } from '../../lib/errors';
import { computeTotals, toCents } from '../../lib/money';

export interface OrderItemInput {
  productId: number;
  quantity: number;
  notes?: string;
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  customerName?: string;
  notes?: string;
}

/** Clave arbitraria para serializar la generación de número de ticket. */
const TICKET_LOCK_KEY = 820_001;

/** Flujo permitido de estados (solo hacia adelante). */
const STATUS_FLOW: OrderStatus[] = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'];

// ─── Helpers internos ────────────────────────────────────────────────────────
async function getOrderForUpdate(tx: Tx, orderId: number): Promise<Order> {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
  if (!order) throw notFound('Orden', orderId);
  return order;
}

function assertEditable(order: Order) {
  if (order.status !== 'PENDING' || order.paymentStatus !== 'UNPAID') {
    throw conflict('Solo se pueden modificar órdenes pendientes y sin pagar');
  }
}

/** Valida productos y arma las líneas de la orden con precio "congelado". */
async function buildLines(tx: Tx, items: OrderItemInput[]) {
  if (items.length === 0) throw badInput('La orden debe tener al menos un producto');

  const ids = [...new Set(items.map((i) => i.productId))];
  const found = await tx.select().from(products).where(inArray(products.id, ids));
  const byId = new Map(found.map((p) => [p.id, p]));

  return items.map((item) => {
    const product = byId.get(item.productId);
    if (!product || !product.active) throw badInput(`El producto #${item.productId} no existe`);
    if (!product.available) throw conflict(`"${product.name}" está agotado`);
    return {
      productId: product.id,
      productName: product.name,
      unitPriceCents: product.priceCents,
      quantity: item.quantity,
      lineTotalCents: product.priceCents * item.quantity,
      notes: item.notes,
    };
  });
}

/** Recalcula subtotal/IVA/total a partir de las líneas guardadas. */
async function recalcTotals(tx: Tx, order: Order) {
  const lines = await tx
    .select({ lineTotalCents: orderItems.lineTotalCents })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  const totals = computeTotals(
    lines.map((l) => l.lineTotalCents),
    order.discountCents,
  );
  const [updated] = await tx.update(orders).set(totals).where(eq(orders.id, order.id)).returning();
  return updated;
}

async function nextTicketNumber(tx: Tx): Promise<number> {
  // Evita que dos cajas generen el mismo número al mismo tiempo
  await tx.execute(sql`select pg_advisory_xact_lock(${sql.raw(String(TICKET_LOCK_KEY))})`);
  const tz = env.BUSINESS_TIMEZONE;
  const result = await tx.execute<{ next: number }>(sql`
    select coalesce(max(${orders.ticketNumber}), 0) + 1 as next
    from ${orders}
    where (${orders.createdAt} at time zone ${tz})::date = (now() at time zone ${tz})::date
  `);
  return Number(result.rows[0]?.next ?? 1);
}

// ─── Casos de uso ────────────────────────────────────────────────────────────
export function createOrder(db: DB, user: AuthUser, input: CreateOrderInput) {
  return db.transaction(async (tx) => {
    const lines = await buildLines(tx, input.items);
    const ticketNumber = await nextTicketNumber(tx);
    const totals = computeTotals(lines.map((l) => l.lineTotalCents));

    const [order] = await tx
      .insert(orders)
      .values({
        ticketNumber,
        customerName: input.customerName,
        notes: input.notes,
        createdById: user.id,
        ...totals,
      })
      .returning();

    await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: order.id })));
    return order;
  });
}

export function addOrderItems(db: DB, orderId: number, items: OrderItemInput[]) {
  return db.transaction(async (tx) => {
    const order = await getOrderForUpdate(tx, orderId);
    assertEditable(order);
    const lines = await buildLines(tx, items);
    await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId })));
    return recalcTotals(tx, order);
  });
}

/** Cambia cantidad/notas de una línea. `quantity = 0` la elimina. */
export function updateOrderItem(
  db: DB,
  itemId: number,
  changes: { quantity?: number; notes?: string },
) {
  return db.transaction(async (tx) => {
    const item = await tx.query.orderItems.findFirst({ where: eq(orderItems.id, itemId) });
    if (!item) throw notFound('Línea de orden', itemId);
    const order = await getOrderForUpdate(tx, item.orderId);
    assertEditable(order);

    if (changes.quantity === 0) {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      if (count <= 1) {
        throw conflict('La orden debe tener al menos un producto; cancélala si ya no se necesita');
      }
      await tx.delete(orderItems).where(eq(orderItems.id, itemId));
    } else {
      const quantity = changes.quantity ?? item.quantity;
      await tx
        .update(orderItems)
        .set({
          quantity,
          lineTotalCents: item.unitPriceCents * quantity,
          ...(changes.notes !== undefined ? { notes: changes.notes } : {}),
        })
        .where(eq(orderItems.id, itemId));
    }
    return recalcTotals(tx, order);
  });
}

export function payOrder(
  db: DB,
  orderId: number,
  method: PaymentMethod,
  amountPaid?: number,
) {
  return db.transaction(async (tx) => {
    const order = await getOrderForUpdate(tx, orderId);
    if (order.status === 'CANCELLED') throw conflict('La orden está cancelada');
    if (order.paymentStatus !== 'UNPAID') throw conflict('La orden ya fue pagada');

    let amountPaidCents = order.totalCents;
    if (method === 'CASH') {
      if (amountPaid === undefined) throw badInput('Indica el monto recibido en efectivo');
      amountPaidCents = toCents(amountPaid);
      if (amountPaidCents < order.totalCents) {
        throw badInput('El monto recibido es menor al total de la orden');
      }
    }

    const [updated] = await tx
      .update(orders)
      .set({
        paymentStatus: 'PAID',
        paymentMethod: method,
        amountPaidCents,
        changeCents: amountPaidCents - order.totalCents,
        paidAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  });
}

export function updateOrderStatus(db: DB, orderId: number, status: OrderStatus) {
  return db.transaction(async (tx) => {
    const order = await getOrderForUpdate(tx, orderId);
    if (status === 'CANCELLED') throw badInput('Usa cancelOrder para cancelar una orden');
    if (order.status === 'CANCELLED') throw conflict('La orden está cancelada');

    const from = STATUS_FLOW.indexOf(order.status);
    const to = STATUS_FLOW.indexOf(status);
    if (to <= from) throw conflict(`No se puede pasar de ${order.status} a ${status}`);
    if (status === 'COMPLETED' && order.paymentStatus !== 'PAID') {
      throw conflict('La orden debe estar pagada antes de completarse');
    }

    const [updated] = await tx
      .update(orders)
      .set({ status, ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}) })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  });
}

export function cancelOrder(db: DB, user: AuthUser, orderId: number, reason: string) {
  return db.transaction(async (tx) => {
    const order = await getOrderForUpdate(tx, orderId);
    if (order.status === 'CANCELLED') throw conflict('La orden ya está cancelada');

    const isPrivileged = user.role === 'ADMIN' || user.role === 'MANAGER';
    if ((order.paymentStatus === 'PAID' || order.status === 'COMPLETED') && !isPrivileged) {
      throw forbidden('Solo un gerente o administrador puede cancelar una orden pagada');
    }

    const [updated] = await tx
      .update(orders)
      .set({
        status: 'CANCELLED',
        cancelReason: reason,
        cancelledAt: new Date(),
        ...(order.paymentStatus === 'PAID' ? { paymentStatus: 'REFUNDED' as const } : {}),
      })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  });
}
