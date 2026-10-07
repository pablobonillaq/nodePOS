# nodePOS

🌐 **English** · [Español](README.es.md)

Point of sale system for a snack business.

```
nodePOS/
├── server/   GraphQL API — Node.js + TypeScript + PostgreSQL  (see server/README.md)
└── client/   Tablet app — React Native CLI + TypeScript
```

> The app's user interface is in Spanish. UI labels are quoted in Spanish below, with their meaning in English.

## Requirements

- Node 20+
- PostgreSQL 16 with the `nodepos` database created (see [server/README.md](server/README.md))
- React Native environment for Android: Android Studio, JDK 17 and `ANDROID_HOME` configured
  ([official guide](https://reactnative.dev/docs/set-up-your-environment))
- A running emulator, or the tablet connected via USB with USB debugging enabled

## First time setup

```bash
npm run install:all                   # installs root, server and client dependencies
copy server\.env.example server\.env  # if it doesn't exist yet (macOS/Linux: cp)
npm run db:push --prefix server       # creates the tables
npm run db:seed --prefix server       # demo users and catalog
```

## Run everything with one command

```bash
npm run dev
```

Starts in order, each step waiting for the previous one:

1. **API**: `server` at `http://localhost:4000/graphql`
2. **METRO**: the React Native bundler, once the API's `/health` responds (includes the DB connection)
3. **APP**: builds and installs the app on the emulator/tablet, once Metro is ready on port 8081

If the app is already installed and you only changed JS/TS code, use `npm run dev:sin-build` (API + Metro, without rebuilding Android) and open the app on the tablet.

| Script | What it does |
|---|---|
| `npm run dev` | API → Metro → builds and installs the app |
| `npm run dev:sin-build` | API → Metro |
| `npm run server` | API only |
| `npm run install:all` | Installs all dependencies |

## Connecting the app to the server

On the login screen, tap **"Servidor: …"** (Server) to change the address:

| Where the app runs | Address |
|---|---|
| Android emulator | `http://10.0.2.2:4000` (default) |
| Physical tablet on the same Wi-Fi | `http://<your-PC-IP>:4000`, e.g. `http://192.168.1.50:4000` |

- To find your PC's IP: `ipconfig` → "IPv4 Address".
- The first time the API runs, Windows may ask for Firewall permission: allow access on **private networks**.
- The address is saved on the tablet; you only need to set it once.

Demo users: `admin / admin123` (full access) and `cajero / cajero123` (cashier: sales and orders). When created by the seed, the app asks them to create their own password on first login.

## The app

| Screen | Who | What it does |
|---|---|---|
| **Venta** (Sale) | Everyone | Menu by category, search, cart with per-item notes, payment in cash (with change), card or bank transfer, or send the order without paying. Long-press a product to mark it as sold out. |
| **Órdenes** (Orders) | Everyone | Kitchen board (Pending / Preparing / Ready) refreshed every 10 s; advance status, take payment or cancel. "Hoy" (Today) tab with the day's history. |
| **Reportes** (Reports) | Admin / Manager | Sales, average ticket, VAT, payment methods, top products and sales by hour/day. |
| **Catálogo** (Catalog) | Admin / Manager | Create, edit and remove products and categories; availability. |
| **Usuarios** (Users) | Admin | Create users (cashier, manager or admin), edit name and role, reset password and activate/deactivate. Creating and resetting generate a temporary password that the user replaces with their own on login. |

Any user can change their password from **"Cambiar contraseña"** (Change password) in the sidebar.

App code in `client/src/`:

```
api/         GraphQL client (fetch), queries and types
components/  buttons, modals, payment, sidebar
context/     session (JWT stored with AsyncStorage)
hooks/       useQuery / useMutation
screens/     Login, Sale, Orders, Reports, Catalog, Users
```

## After updating the server

If the database schema changed (for example, after adding user management):

```bash
npm run db:push --prefix server
```

## Troubleshooting

- **"No se pudo conectar con el servidor"** (could not connect to the server): check the server address on the login screen, that the API is running, and that the Firewall allows port 4000.
- **Metro never starts**: the API isn't responding on `/health`; usually PostgreSQL is stopped or `DATABASE_URL` is wrong.
- **`adb` / `ANDROID_HOME` not found**: the Android environment isn't set up (see Requirements).
