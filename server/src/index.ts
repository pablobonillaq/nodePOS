import cors from 'cors';
import express from 'express';
import { createYoga } from 'graphql-yoga';
import { env, isProd } from './config/env';
import { pool } from './db/client';
import { createContext } from './graphql/context';
import { schema } from './graphql/schema';

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);

// Health check REST (útil para Docker / balanceadores / la tablet al iniciar)
app.get('/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({ status: 'ok', db: 'up', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: '/graphql',
  // GraphiQL solo en desarrollo
  graphiql: !isProd && {
    title: 'nodePOS API',
    defaultQuery: /* GraphQL */ `# 1) Inicia sesión y copia el token
# 2) En "Headers" agrega: { "Authorization": "Bearer <token>" }
mutation Login {
  login(username: "admin", password: "admin123") {
    token
    user { id name role }
  }
}
`,
  },
  // Oculta detalles de errores inesperados en producción
  maskedErrors: isProd,
  landingPage: false,
});

app.use(yoga.graphqlEndpoint, yoga);

const server = app.listen(env.PORT, () => {
  console.log(`🚀 nodePOS API lista en http://localhost:${env.PORT}${yoga.graphqlEndpoint}`);
});

async function shutdown(signal: string) {
  console.log(`\n${signal} recibido, cerrando...`);
  server.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
