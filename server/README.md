# nodePOS — Snack Point of Sale API

🌐 **English** · [Español](README.es.md)

**GraphQL** backend in **Node.js + TypeScript + PostgreSQL** for a fast food / snack point of sale. Designed to be consumed by a tablet app as the client.

## Stack

| Piece | Technology |
|---|---|
| HTTP server | Express 5 |
| GraphQL | GraphQL Yoga 5 (includes GraphiQL in development) |
| Database | PostgreSQL 16 |
| ORM / migrations | Drizzle ORM + drizzle-kit |
| Auth | JWT (`Authorization: Bearer <token>`) + bcrypt |
| Validation | Zod |

## Structure

```
src/
├── index.ts               # Express + Yoga startup, /health
├── config/env.ts          # Environment variables validated with zod
├── db/
│   ├── schema.ts          # Tables: users, categories, products, orders, order_items
│   ├── client.ts          # pg pool + Drizzle instance
│   └── seed.ts            # Admin, demo cashier and sample catalog
├── graphql/
│   ├── base.ts            # Root Query/Mutation, DateTime scalar
│   ├── context.ts         # Per-request context (db + user loaded from the JWT)
│   └── schema.ts          # Merges module typeDefs and resolvers
├── lib/                   # auth (JWT, guards), errors, money, utilities
└── modules/
    ├── auth/              # login, users and roles
    ├── catalog/           # categories and products
    ├── orders/            # orders, line items, payments, statuses
    └── reports/           # sales summary, top products, by day/hour
```

## Getting started

Requirements: **Node 20+** and **PostgreSQL 16** installed on your machine (Docker is not required).

### 1. Install PostgreSQL (Windows)

```bash
winget install PostgreSQL.PostgreSQL.16
```

Or download the installer from <https://www.postgresql.org/download/windows/>. During installation, set a password for the `postgres` user and **write it down**. Keep the port at `5432`.

### 2. Create the user and the database

Open **SQL Shell (psql)** from the Start menu. The console asks its questions one at a time: press **Enter** at `Server`, `Database`, `Port` and `Username` to accept the defaults, then type the `postgres` password (it isn't shown as you type).

> If it isn't in the menu: `"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres`

At the `postgres=#` prompt run:

```sql
CREATE USER pos WITH PASSWORD 'pos';
CREATE DATABASE nodepos OWNER pos;
```

Exit with `\q`. (You can also do this from **pgAdmin 4** → right-click the server → *Query Tool* → F5.)

### 3. Configure and start the API

```bash
npm install
copy .env.example .env        # macOS/Linux: cp .env.example .env
npm run db:push               # creates the tables from src/db/schema.ts
npm run db:seed               # admin/admin123, cajero/cajero123 and demo catalog
npm run dev                   # http://localhost:4000/graphql
```

The `.env` already points to `postgres://pos:pos@localhost:5432/nodepos`. If you used a different user, password or port, adjust `DATABASE_URL`. Also replace `JWT_SECRET` with a long random string.

Open `http://localhost:4000/graphql` in your browser to use GraphiQL.

> For production, use versioned migrations: `npm run db:generate` (generates SQL in `drizzle/`) and `npm run db:migrate`.

### Alternative: PostgreSQL with Docker

If you have Docker Desktop installed, you can skip steps 1 and 2 and run `npm run db:up` (uses `docker-compose.yml` with the same credentials).

## Scripts

| Script | Description |
|---|---|
| `dev` | Server with auto-reload (tsx watch) |
| `build` / `start` | Compiles to `dist/` and runs it |
| `typecheck` | Type-checks without compiling |
| `db:up` / `db:down` | (Optional, requires Docker) Starts / stops PostgreSQL in a container |
| `db:push` | Syncs the schema directly to the DB (development) |
| `db:generate` / `db:migrate` | Generates / applies SQL migrations |
| `db:studio` | Visual DB explorer |
| `db:seed` | Initial data |

## Business rules

- **Money in cents**: everything is stored as integers in the DB (`price_cents`, `total_cents`…); the API exposes pesos as `Float`.
- **VAT included**: catalog prices already include VAT (`TAX_RATE`, 16% by default). The order total is the sum of its lines and the tax is broken out.
- **Frozen price**: each line stores the product's name and price at the time of sale.
- **Daily ticket**: `ticketNumber` resets every day (in the `BUSINESS_TIMEZONE` time zone).
- **Status flow**: `PENDING → PREPARING → READY → COMPLETED` (forward only). `COMPLETED` requires the order to be paid. `CANCELLED` only via `cancelOrder`.
- **Editing**: products can only be added/removed while the order is `PENDING` and unpaid.
- **Payments**: `CASH` requires `amountPaid` and calculates `change`; `CARD` and `TRANSFER` charge the exact total.
- **Cancellations**: a cashier can cancel unpaid orders; paid ones only ADMIN/MANAGER (they become `REFUNDED`).
- **Soft deletes**: deleting products/categories sets `active = false`. `available = false` means temporarily sold out.

## Roles

| Action | CASHIER | MANAGER | ADMIN |
|---|:-:|:-:|:-:|
| View catalog, create/charge orders, mark sold out | ✅ | ✅ | ✅ |
| Cancel paid orders | | ✅ | ✅ |
| Create/edit products and categories | | ✅ | ✅ |
| Reports | | ✅ | ✅ |
| Manage users (create, reset password, deactivate) | | | ✅ |

## Examples for the tablet

All operations (except `login` and `health`) require the `Authorization: Bearer <token>` header.

```graphql
mutation { login(username: "cajero", password: "cajero123") { token user { id name role mustChangePassword } } }

# Menu to render the sale screen
query Menu {
  categories {
    id name color
    products(onlyAvailable: true) { id name price imageUrl }
  }
}

# Create an order
mutation {
  createOrder(input: {
    customerName: "Ana"
    items: [
      { productId: 1, quantity: 2, notes: "no chili" }
      { productId: 10, quantity: 1 }
    ]
  }) { id ticketNumber total items { productName quantity lineTotal notes } }
}

# Pay in cash
mutation { payOrder(orderId: 1, method: CASH, amountPaid: 200) { total amountPaid change paymentStatus } }

# Kitchen view
query { activeOrders { id ticketNumber status customerName items { productName quantity notes } } }
mutation { updateOrderStatus(orderId: 1, status: PREPARING) { id status } }

# End-of-day report (no from/to = today)
query {
  salesSummary { orderCount grossSales tax netSales averageTicket byPaymentMethod { method total } }
  topProducts(limit: 5) { productName quantity revenue }
  salesByHour { hour orderCount total }
}
```

## Users and passwords

- **Temporary passwords**: the administrator never chooses or knows anyone's final password. `createUser` and `resetUserPassword` generate a random temporary password (e.g. `K7PM-W3XQ`) that is shown **only once** and expires in 24 h.
- **Mandatory change**: whoever logs in with a temporary password gets a restricted token; the server rejects everything with `PASSWORD_CHANGE_REQUIRED` except `me` and `changePassword`, until they choose their own password (min. 8 characters, with letters and numbers).
- **Immediate revocation**: each user has a `token_version`. Resetting the password, deactivating the user or changing the password increments it, and all previous sessions stop working instantly. Role and active status are read from the DB on every request.
- **Traceability**: `lastLoginAt` and `passwordChangedAt` are recorded. If the administrator used the temporary password before the user did, the user would notice because it would no longer work, and would have to request another reset.
- Seed users (`admin`, `cajero`) must also change their password on first login.

> After updating to this version, run `npm run db:push` to add the new columns to `users`. Open sessions are closed and users must log in again.

## Errors

Business errors are returned in `errors[].extensions.code`: `UNAUTHENTICATED`, `FORBIDDEN`, `PASSWORD_CHANGE_REQUIRED`, `BAD_USER_INPUT`, `NOT_FOUND`, `CONFLICT`. In production, unexpected errors are masked.

## Suggested next steps

- `graphql-codegen` to generate types for resolvers and the tablet client.
- DataLoader to avoid N+1 queries in `Order.items`, `Product.category`, etc.
- Subscriptions (Yoga supports them via SSE) to notify the kitchen of new orders in real time.
- PIN login for quick cashier switching on the tablet.
- Shifts / cash register closing with opening float and withdrawals.
- Product modifiers (size, extras) and inventory.
- Tests (Vitest) and a Dockerfile for the API.
