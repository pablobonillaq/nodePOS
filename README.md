# nodePOS

Punto de venta para un negocio de snacks.

```
nodePOS/
├── server/   API GraphQL — Node.js + TypeScript + PostgreSQL  (ver server/README.md)
└── client/   App para tablet — React Native CLI + TypeScript
```

## Requisitos

- Node 20+
- PostgreSQL 16 con la base `nodepos` creada (ver [server/README.md](server/README.md))
- Entorno de React Native para Android: Android Studio, JDK 17 y `ANDROID_HOME` configurado
  ([guía oficial](https://reactnative.dev/docs/set-up-your-environment))
- Un emulador abierto o la tablet conectada por USB con depuración USB activada

## Primera vez

```bash
npm run install:all                 # instala dependencias de raíz, server y client
copy server\.env.example server\.env  # si aún no existe
npm run db:push --prefix server     # crea las tablas
npm run db:seed --prefix server     # usuarios y catálogo demo
```

## Ejecutar todo con un comando

```bash
npm run dev
```

Arranca en orden, cada paso espera al anterior:

1. **API**: `server` en `http://localhost:4000/graphql`
2. **METRO**: el empaquetador de React Native, cuando `/health` de la API responde (incluye conexión a la BD)
3. **APP**: compila e instala la app en el emulador/tablet, cuando Metro está listo en el puerto 8081

Si la app ya está instalada y solo cambiaste código JS/TS, usa `npm run dev:sin-build` (API + Metro, sin recompilar Android) y abre la app en la tablet.

| Script | Qué hace |
|---|---|
| `npm run dev` | API → Metro → compila e instala la app |
| `npm run dev:sin-build` | API → Metro |
| `npm run server` | Solo la API |
| `npm run install:all` | Instala dependencias de todo |

## Conectar la app al servidor

En la pantalla de login toca **"Servidor: …"** para cambiar la dirección:

| Dónde corre la app | Dirección |
|---|---|
| Emulador de Android | `http://10.0.2.2:4000` (valor por defecto) |
| Tablet física en la misma Wi-Fi | `http://<IP-de-tu-PC>:4000`, ej. `http://192.168.1.50:4000` |

- Para ver la IP de tu PC: `ipconfig` → "Dirección IPv4".
- La primera vez que corre la API, Windows puede pedir permiso en el Firewall: permite el acceso en **redes privadas**.
- La dirección se guarda en la tablet; solo hay que configurarla una vez.

Usuarios demo: `admin / admin123` (todo) y `cajero / cajero123` (venta y órdenes). Al crearse con el seed, la app les pide crear su propia contraseña en el primer inicio de sesión.

## La app

| Pantalla | Quién | Qué hace |
|---|---|---|
| **Venta** | Todos | Menú por categorías, búsqueda, carrito con notas por producto, cobro en efectivo (con cambio), tarjeta o transferencia, o enviar sin cobrar. Mantén presionado un producto para marcarlo agotado. |
| **Órdenes** | Todos | Tablero de cocina (Pendientes / Preparando / Listas) que se actualiza cada 10 s; avanzar estado, cobrar o cancelar. Pestaña "Hoy" con el historial del día. |
| **Reportes** | Admin / Gerente | Ventas, ticket promedio, IVA, formas de pago, top productos y ventas por hora/día. |
| **Catálogo** | Admin / Gerente | Alta, edición y baja de productos y categorías, disponibilidad. |
| **Usuarios** | Admin | Crear usuarios (cajero, gerente o administrador), editar nombre y rol, restablecer contraseña y activar/desactivar. Crear y restablecer generan una contraseña temporal que el usuario cambia por una propia al entrar. |

Cualquier usuario puede cambiar su contraseña desde **"Cambiar contraseña"** en la barra lateral.

Código de la app en `client/src/`:

```
api/         cliente GraphQL (fetch), consultas y tipos
components/  botones, modales, cobro, barra lateral
context/     sesión (JWT guardado con AsyncStorage)
hooks/       useQuery / useMutation
screens/     Login, Venta, Órdenes, Reportes, Catálogo
```

## Después de actualizar el servidor

Si el esquema de la base cambió (por ejemplo, al agregar la administración de usuarios):

```bash
npm run db:push --prefix server
```

## Problemas comunes

- **"No se pudo conectar con el servidor"**: revisa la dirección del servidor en el login, que la API esté corriendo y que el Firewall permita el puerto 4000.
- **Metro nunca arranca**: la API no responde en `/health`; normalmente PostgreSQL está detenido o `DATABASE_URL` es incorrecta.
- **`adb` / `ANDROID_HOME` no encontrado**: falta configurar el entorno de Android (ver Requisitos).
