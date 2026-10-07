import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Todos los importes monetarios se guardan en CENTAVOS (enteros)
 * para evitar errores de redondeo con decimales.
 */

export const userRole = pgEnum('user_role', ['ADMIN', 'MANAGER', 'CASHIER']);
export const orderStatus = pgEnum('order_status', [
  'PENDING', // creada, aún se pueden agregar/quitar productos
  'PREPARING', // en cocina
  'READY', // lista para entregar
  'COMPLETED', // entregada
  'CANCELLED',
]);
export const paymentStatus = pgEnum('payment_status', ['UNPAID', 'PAID', 'REFUNDED']);
export const paymentMethod = pgEnum('payment_method', ['CASH', 'CARD', 'TRANSFER']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// ─── Usuarios ────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  username: varchar('username', { length: 60 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('CASHIER'),
  active: boolean('active').notNull().default(true),
  /** true = la contraseña actual es temporal y debe cambiarse al iniciar sesión */
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  /** Vencimiento de la contraseña temporal (null = sin vencimiento) */
  tempPasswordExpiresAt: timestamp('temp_password_expires_at', { withTimezone: true }),
  /** Se incrementa para invalidar todos los tokens emitidos (reset, desactivación, cambio) */
  tokenVersion: integer('token_version').notNull().default(0),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  ...timestamps,
});

// ─── Catálogo ────────────────────────────────────────────────────────────────
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 80 }).notNull().unique(),
  description: text('description'),
  color: varchar('color', { length: 16 }), // para pintar botones en la tablet
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    sku: varchar('sku', { length: 40 }).unique(),
    priceCents: integer('price_cents').notNull(),
    imageUrl: text('image_url'),
    available: boolean('available').notNull().default(true), // agotado temporalmente
    active: boolean('active').notNull().default(true), // baja lógica
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('products_category_idx').on(t.categoryId)],
);

// ─── Órdenes ─────────────────────────────────────────────────────────────────
export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    /** Número de ticket que se reinicia cada día (1, 2, 3...) */
    ticketNumber: integer('ticket_number').notNull(),
    status: orderStatus('status').notNull().default('PENDING'),
    paymentStatus: paymentStatus('payment_status').notNull().default('UNPAID'),
    paymentMethod: paymentMethod('payment_method'),
    customerName: varchar('customer_name', { length: 120 }),
    notes: text('notes'),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    taxCents: integer('tax_cents').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    amountPaidCents: integer('amount_paid_cents'),
    changeCents: integer('change_cents'),
    cancelReason: text('cancel_reason'),
    createdById: integer('created_by_id')
      .notNull()
      .references(() => users.id),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('orders_status_idx').on(t.status),
    index('orders_created_at_idx').on(t.createdAt),
    index('orders_paid_at_idx').on(t.paidAt),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    // Copia del nombre y precio al momento de la venta (por si cambia el catálogo)
    productName: varchar('product_name', { length: 120 }).notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    quantity: integer('quantity').notNull(),
    lineTotalCents: integer('line_total_cents').notNull(),
    notes: text('notes'), // ej. "sin cebolla", "extra salsa"
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId), index('order_items_product_idx').on(t.productId)],
);

// ─── Relaciones ──────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  orderItems: many(orderItems),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  createdBy: one(users, { fields: [orders.createdById], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

// ─── Tipos inferidos ─────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type UserRole = (typeof userRole.enumValues)[number];
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
