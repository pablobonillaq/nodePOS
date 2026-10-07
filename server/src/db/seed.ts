/**
 * Carga datos iniciales: usuario admin, un cajero de ejemplo y un catálogo de snacks.
 * Es idempotente: si ya existen, no los duplica.
 *
 *   npm run db:seed
 */
import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { hashPassword } from '../lib/auth';
import { toCents } from '../lib/money';
import { db, pool } from './client';
import { categories, products, users } from './schema';

const catalog: Record<string, { color: string; items: [name: string, price: number][] }> = {
  Snacks: {
    color: '#F59E0B',
    items: [
      ['Papas preparadas', 45],
      ['Elote en vaso', 40],
      ['Nachos con queso', 55],
      ['Tostilocos', 60],
      ['Palomitas', 30],
    ],
  },
  Antojitos: {
    color: '#EF4444',
    items: [
      ['Hot dog', 45],
      ['Hamburguesa sencilla', 75],
      ['Sincronizada', 50],
      ['Alitas (6 pzas)', 95],
    ],
  },
  Bebidas: {
    color: '#3B82F6',
    items: [
      ['Refresco 600 ml', 25],
      ['Agua fresca', 30],
      ['Agua natural', 18],
      ['Frappé', 55],
    ],
  },
  Postres: {
    color: '#EC4899',
    items: [
      ['Fresas con crema', 50],
      ['Churros (3 pzas)', 35],
      ['Nieve', 35],
    ],
  },
};

async function upsertUser(name: string, username: string, password: string, role: 'ADMIN' | 'CASHIER') {
  const existing = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (existing) return console.log(`• Usuario "${username}" ya existe`);
  // Contraseña conocida (demo): se obliga a cambiarla en el primer inicio de sesión
  await db.insert(users).values({
    name,
    username,
    role,
    passwordHash: await hashPassword(password),
    mustChangePassword: true,
  });
  console.log(`✓ Usuario "${username}" (${role}) creado`);
}

async function main() {
  await upsertUser('Administrador', env.SEED_ADMIN_USERNAME, env.SEED_ADMIN_PASSWORD, 'ADMIN');
  await upsertUser('Cajero Demo', 'cajero', 'cajero123', 'CASHIER');

  let sortOrder = 0;
  for (const [categoryName, { color, items }] of Object.entries(catalog)) {
    let category = await db.query.categories.findFirst({ where: eq(categories.name, categoryName) });
    if (!category) {
      [category] = await db
        .insert(categories)
        .values({ name: categoryName, color, sortOrder: sortOrder++ })
        .returning();
      console.log(`✓ Categoría "${categoryName}"`);
    }

    for (const [i, [name, price]] of items.entries()) {
      const exists = await db.query.products.findFirst({ where: eq(products.name, name) });
      if (exists) continue;
      await db.insert(products).values({
        name,
        priceCents: toCents(price),
        categoryId: category.id,
        sortOrder: i,
      });
    }
  }
  console.log('✓ Catálogo listo');
}

main()
  .catch((err) => {
    console.error('❌ Error en el seed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
