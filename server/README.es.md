# nodePOS — API para punto de venta de snacks

🌐 [English](README.md) · **Español**

Backend **GraphQL** en **Node.js + TypeScript + PostgreSQL** para un punto de venta de comida rápida/snacks. Pensado para que una app de tablet lo consuma como cliente.

## Stack

| Pieza | Tecnología |
|---|---|
| Servidor HTTP | Express 5 |
| GraphQL | GraphQL Yoga 5 (incluye GraphiQL en desarrollo) |
| Base de datos | PostgreSQL 16 |
| ORM / migraciones | Drizzle ORM + drizzle-kit |
| Auth | JWT (`Authorization: Bearer <token>`) + bcrypt |
| Validación | Zod |

## Estructura

```
src/
├── index.ts               # Arranque de Express + Yoga, /health
├── config/env.ts          # Variables de entorno validadas con zod
├── db/
│   ├── schema.ts          # Tablas: users, categories, products, orders, order_items
│   ├── client.ts          # Pool de pg + instancia de Drizzle
│   └── seed.ts            # Admin, cajero demo y catálogo de ejemplo
├── graphql/
│   ├── base.ts            # Query/Mutation raíz, scalar DateTime
│   ├── context.ts         # Contexto por request (db + usuario del JWT)
│   └── schema.ts          # Une typeDefs y resolvers de los módulos
├── lib/                   # auth (JWT, guards), errores, dinero, utilidades
└── modules/
    ├── auth/              # login, usuarios y roles
    ├── catalog/           # categorías y productos
    ├── orders/            # órdenes, líneas, pagos, estados
    └── reports/           # resumen de ventas, top productos, por día/hora
```

## Puesta en marcha

Requisitos: **Node 20+** y **PostgreSQL 16** instalado en tu equipo (no se necesita Docker).

### 1. Instalar PostgreSQL (Windows)

```bash
winget install PostgreSQL.PostgreSQL.16
```

O descarga el instalador desde <https://www.postgresql.org/download/windows/>. Durante la instalación define una contraseña para el usuario `postgres` y **anótala**. Deja el puerto en `5432`.

### 2. Crear el usuario y la base de datos

Abre **SQL Shell (psql)** desde el menú Inicio. La consola hace las preguntas una por una: presiona **Enter** en `Server`, `Database`, `Port` y `Username` para aceptar los valores por defecto, y luego escribe la contraseña de `postgres` (no se ve al escribirla).

> Si no aparece en el menú: `"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres`

En el prompt `postgres=#` ejecuta:

```sql
CREATE USER pos WITH PASSWORD 'pos';
CREATE DATABASE nodepos OWNER pos;
```

Sal con `\q`. (También puedes hacerlo desde **pgAdmin 4** → clic derecho en el servidor → *Query Tool* → F5.)

### 3. Configurar y arrancar la API

```bash
npm install
copy .env.example .env        # macOS/Linux: cp .env.example .env
npm run db:push               # crea las tablas a partir de src/db/schema.ts
npm run db:seed               # admin/admin123, cajero/cajero123 y catálogo demo
npm run dev                   # http://localhost:4000/graphql
```

El `.env` ya apunta a `postgres://pos:pos@localhost:5432/nodepos`. Si usaste otro usuario, contraseña o puerto, ajusta `DATABASE_URL`.

Abre `http://localhost:4000/graphql` en el navegador para usar GraphiQL.

> Para producción usa migraciones versionadas: `npm run db:generate` (genera SQL en `drizzle/`) y `npm run db:migrate`.

### Alternativa: PostgreSQL con Docker

Si tienes Docker Desktop instalado, puedes saltarte los pasos 1 y 2 y ejecutar `npm run db:up` (usa `docker-compose.yml` con las mismas credenciales).

## Scripts

| Script | Descripción |
|---|---|
| `dev` | Servidor con recarga automática (tsx watch) |
| `build` / `start` | Compila a `dist/` y ejecuta |
| `typecheck` | Verifica tipos sin compilar |
| `db:up` / `db:down` | (Opcional, requiere Docker) Inicia / detiene PostgreSQL en contenedor |
| `db:push` | Sincroniza el esquema directo a la BD (desarrollo) |
| `db:generate` / `db:migrate` | Genera / aplica migraciones SQL |
| `db:studio` | Explorador visual de la BD |
| `db:seed` | Datos iniciales |

## Reglas de negocio

- **Dinero en centavos**: en BD todo es entero (`price_cents`, `total_cents`…); la API expone pesos como `Float`.
- **IVA incluido**: los precios del catálogo ya incluyen IVA (`TAX_RATE`, 16% por defecto). El total de la orden es la suma de líneas y el impuesto se desglosa.
- **Precio congelado**: cada línea guarda nombre y precio del producto al momento de la venta.
- **Ticket diario**: `ticketNumber` se reinicia cada día (zona horaria `BUSINESS_TIMEZONE`).
- **Flujo de estados**: `PENDING → PREPARING → READY → COMPLETED` (solo hacia adelante). `COMPLETED` exige que esté pagada. `CANCELLED` solo vía `cancelOrder`.
- **Edición**: solo se agregan/quitan productos mientras la orden está `PENDING` y sin pagar.
- **Pagos**: `CASH` requiere `amountPaid` y calcula `change`; `CARD` y `TRANSFER` cobran el total exacto.
- **Cancelaciones**: un cajero puede cancelar órdenes no pagadas; las pagadas solo ADMIN/MANAGER (quedan como `REFUNDED`).
- **Bajas lógicas**: borrar productos/categorías los marca `active = false`. `available = false` es "agotado" temporal.

## Roles

| Acción | CASHIER | MANAGER | ADMIN |
|---|:-:|:-:|:-:|
| Ver catálogo, crear/cobrar órdenes, marcar agotado | ✅ | ✅ | ✅ |
| Cancelar órdenes pagadas | | ✅ | ✅ |
| Crear/editar productos y categorías | | ✅ | ✅ |
| Reportes | | ✅ | ✅ |
| Gestionar usuarios (crear, restablecer contraseña, desactivar) | | | ✅ |

## Ejemplos para la tablet

Todas las operaciones (excepto `login` y `health`) requieren el header `Authorization: Bearer <token>`.

```graphql
mutation { login(username: "cajero", password: "cajero123") { token user { id name role mustChangePassword } } }

# Menú para pintar la pantalla de venta
query Menu {
  categories {
    id name color
    products(onlyAvailable: true) { id name price imageUrl }
  }
}

# Crear orden
mutation {
  createOrder(input: {
    customerName: "Ana"
    items: [
      { productId: 1, quantity: 2, notes: "sin chile" }
      { productId: 10, quantity: 1 }
    ]
  }) { id ticketNumber total items { productName quantity lineTotal notes } }
}

# Cobrar en efectivo
mutation { payOrder(orderId: 1, method: CASH, amountPaid: 200) { total amountPaid change paymentStatus } }

# Vista de cocina
query { activeOrders { id ticketNumber status customerName items { productName quantity notes } } }
mutation { updateOrderStatus(orderId: 1, status: PREPARING) { id status } }

# Corte del día (sin from/to = hoy)
query {
  salesSummary { orderCount grossSales tax netSales averageTicket byPaymentMethod { method total } }
  topProducts(limit: 5) { productName quantity revenue }
  salesByHour { hour orderCount total }
}
```

## Usuarios y contraseñas

- **Contraseñas temporales**: el administrador nunca elige ni conoce la contraseña definitiva de nadie. `createUser` y `resetUserPassword` generan una contraseña temporal aleatoria (ej. `K7PM-W3XQ`) que se muestra **una sola vez** y vence en 24 h.
- **Cambio obligatorio**: quien inicia sesión con una contraseña temporal recibe un token restringido; el servidor rechaza todo con `PASSWORD_CHANGE_REQUIRED` excepto `me` y `changePassword`, hasta que elija su propia contraseña (mín. 8 caracteres, con letras y números).
- **Revocación inmediata**: cada usuario tiene un `token_version`. Restablecer la contraseña, desactivar al usuario o cambiar la contraseña lo incrementa, y todas las sesiones anteriores dejan de funcionar al instante. El rol y el estado activo se leen de la BD en cada request.
- **Trazabilidad**: se guardan `lastLoginAt` y `passwordChangedAt`. Si el administrador usara la contraseña temporal antes que el usuario, este lo notaría porque ya no le funcionaría y tendría que pedir otro restablecimiento.
- Los usuarios del seed (`admin`, `cajero`) también deben cambiar su contraseña en el primer inicio de sesión.

> Tras actualizar a esta versión ejecuta `npm run db:push` para agregar las columnas nuevas a `users`. Las sesiones abiertas se cierran y hay que volver a iniciar sesión.

## Errores

Los errores de negocio llegan en `errors[].extensions.code`: `UNAUTHENTICATED`, `FORBIDDEN`, `BAD_USER_INPUT`, `NOT_FOUND`, `CONFLICT`. En producción los errores inesperados se ocultan.

## Siguientes pasos sugeridos

- `graphql-codegen` para generar tipos de resolvers y del cliente de la tablet.
- DataLoader para evitar N+1 en `Order.items`, `Product.category`, etc.
- Suscripciones (Yoga las soporta vía SSE) para avisar a cocina de órdenes nuevas en tiempo real.
- Login por PIN para cambiar rápido de cajero en la tablet.
- Turnos / corte de caja con fondo inicial y retiros.
- Modificadores de producto (tamaño, extras) e inventario.
- Pruebas (Vitest) y Dockerfile para la API.
