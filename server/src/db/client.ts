import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });

export const db = drizzle({ client: pool, schema });

export type DB = typeof db;
/** Tipo de una transacción de Drizzle (para servicios que reciben `tx`). */
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
