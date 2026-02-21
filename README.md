# Vantage Fashion  Documentación Técnica

> Tienda online de moda masculina premium con panel de administración completo.  
> Desarrollada con Astro SSR, React, Supabase, Stripe y Resend.

---

## Índice

1. [Visión general del proyecto](#1-visión-general-del-proyecto)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arquitectura y estructura de archivos](#3-arquitectura-y-estructura-de-archivos)
4. [Base de datos](#4-base-de-datos)
5. [Variables de entorno](#5-variables-de-entorno)
6. [La tienda  funcionalidades para el cliente](#6-la-tienda--funcionalidades-para-el-cliente)
7. [Panel de administración](#7-panel-de-administración)
8. [Sistema de emails](#8-sistema-de-emails)
9. [Sistema de facturas y PDFs](#9-sistema-de-facturas-y-pdfs)
10. [Seguridad](#10-seguridad)
11. [Despliegue](#11-despliegue)
12. [Manual de usuario  Admin](#12-manual-de-usuario--admin)

---

## 1. Visión general del proyecto

**Vantage Fashion** es una tienda online completa que permite:

- A los **clientes**: navegar el catálogo, añadir al carrito y lista de deseos, pagar con tarjeta, hacer seguimiento de sus pedidos y gestionar devoluciones.
- A los **administradores**: gestionar todo el negocio desde un panel privado: productos, pedidos, envíos, devoluciones, facturas, cupones, newsletter y analíticas.

La web está desplegada en producción en: `https://nicovantage.victoriafp.online`

---

## 2. Stack tecnológico

| Capa | Tecnología | Para qué se usa |
|---|---|---|
| Framework | **Astro 5 (SSR)** | Renderizado en servidor, rutas, middleware |
| UI interactiva | **React 19** | Componentes de carrito, checkout, botones de acción |
| Base de datos | **Supabase (PostgreSQL)** | Todos los datos del negocio |
| Autenticación | **Supabase Auth** | Login de clientes y admins |
| Pagos | **Stripe** | Checkout, cobros, reembolsos |
| Emails | **Resend** | Confirmaciones, alertas, newsletter |
| Imágenes | **Cloudinary** | Subida y gestión de imágenes de productos |
| PDFs | **pdfkit** | Generación de facturas y etiquetas de devolución |
| Códigos de barras | **bwip-js** | Etiqueta de devolución en el PDF |
| Estilos | **Tailwind CSS 4** | Diseño y componentes |
| Despliegue | **Docker / nixpacks** | Contenedor de producción |

---

## 3. Arquitectura y estructura de archivos

```
FashionShop/
 src/
    middleware.ts          # Protección de rutas admin + headers de seguridad
    lib/
       supabase.ts        # Clientes Supabase (anon, service role, per-request)
       auth.ts            # Helpers de sesión de usuario
       adminAuth.ts       # Verificación de sesión admin para APIs
       email.ts           # Todas las funciones de envío de email (Resend)
       invoice.ts         # Generación de facturas HTML y PDF (pdfkit)
       cloudinary.ts      # Subida y borrado de imágenes
       utils.ts           # Formateo de precios y utilidades comunes
    pages/
       index.astro        # Home  hero, categorías, productos destacados
       productos/         # Catálogo y ficha de producto
       categoria/         # Página de categoría filtrada
       carrito.astro      # Carrito de compra
       checkout.astro     # Proceso de pago con Stripe
       checkout/          # Páginas de éxito y cancelación post-pago
       pedido/[id].astro  # Detalle de pedido del cliente + factura web
       perfil.astro       # Cuenta del cliente, historial de pedidos
       favoritos.astro    # Lista de deseos
       login.astro        # Login de clientes
       registro.astro     # Registro de clientes
       admin/             # Panel de administración (protegido)
       api/               # Endpoints del servidor (REST)
    components/
       islands/           # Componentes React interactivos
       product/           # Tarjetas de producto, galería
       ui/                # Navbar, footer, popup newsletter, etc.
    layouts/               # BaseLayout, AdminLayout, PublicLayout
    stores/
        cart.ts            # Estado del carrito (nanostores)
 sql/                       # Scripts SQL de migraciones y configuración
 Dockerfile                 # Imagen Docker para producción
 nixpacks.toml              # Config para despliegue en Railway/nixpacks
 astro.config.mjs           # Configuración de Astro (SSR, node adapter)
```

### Cómo funciona el renderizado

Astro funciona en modo **SSR completo** (`output: 'server'`). Cada página se renderiza en el servidor en cada petición. Los componentes marcados con `client:load` o `client:only` son islas React que se hidratan en el navegador para la interactividad (carrito, botones de añadir al carrito, etc.).

---

## 4. Base de datos

### Tablas principales

| Tabla | Descripción |
|---|---|
| `products` | Catálogo de productos con precio, stock, imágenes, descripción |
| `product_sizes` | Stock por talla para cada producto |
| `categories` | Categorías del catálogo con imagen |
| `orders` | Pedidos realizados por los clientes |
| `order_items` | Líneas de cada pedido (producto, cantidad, precio, talla) |
| `customers` | Perfil extendido de clientes (vinculado a Supabase Auth) |
| `returns` | Solicitudes de devolución |
| `invoices` | Facturas generadas para cada pedido |
| `invoice_items` | Líneas de cada factura |
| `coupons` | Códigos de descuento |
| `coupon_usages` | Registro de usos de cada cupón por cliente |
| `shipping_methods` | Métodos de envío (Estándar, Express, Recogida en tienda) |
| `shipping_carriers` | Transportistas disponibles |
| `user_shipping_addresses` | Direcciones guardadas de cada cliente |
| `wishlist` | Lista de deseos por usuario |
| `wishlist_notifications` | Control de notificaciones enviadas por wishlist |
| `newsletter_subscribers` | Suscriptores al newsletter |
| `admin_users` | Usuarios con acceso al panel admin |
| `app_settings` | Configuración dinámica de la aplicación (popup, etc.) |

### Seguridad de base de datos (RLS)

Todas las tablas tienen **Row Level Security** activado en Supabase. Las políticas garantizan que:
- Los clientes solo ven y modifican sus propios datos.
- Las operaciones de administración usan el cliente `service_role` (bypass de RLS) solo desde el servidor.

---

## 5. Variables de entorno

Crea un archivo `.env` en la raíz con estas variables:

```env
# Supabase
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Resend (emails)
RESEND_API_KEY=re_...
ADMIN_EMAIL=admin@vantage.com

# Cloudinary (imágenes)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# General
PUBLIC_SITE_URL=https://nicovantage.victoriafp.online
ADMIN_API_KEY=clave-secreta-para-apis-externas
```

---

## 6. La tienda  funcionalidades para el cliente

### 6.1 Home (`/`)

La página principal muestra:
- **Hero** con imagen de fondo y llamada a la acción.
- **Categorías destacadas** con imagen (Camisas, Pantalones, Chaquetas, etc.).
- **Productos más vendidos** y **nuevas llegadas**.
- **Popup de newsletter** con código promocional de bienvenida (configurable desde el panel admin). Solo aparece si el visitante no está ya suscrito y pasado el tiempo de espera configurado.

### 6.2 Catálogo y ficha de producto (`/productos`, `/productos/[slug]`)

- Listado de productos con filtros por categoría, precio y talla.
- Buscador en tiempo real.
- Ficha de producto con galería de imágenes, selector de talla, stock en tiempo real, botón de añadir al carrito y botón de lista de deseos.
- Indicador de "Pocas unidades" cuando el stock es bajo.
- Precio original tachado cuando el producto está en oferta.

### 6.3 Carrito (`/carrito`)

- Gestionado con **nanostores** (estado compartido entre islas React).
- Persiste en `localStorage` del navegador.
- Muestra productos, cantidades, subtotal, método de envío seleccionado y descuento de cupón.
- Permite aplicar códigos de cupón (validados en el servidor).

### 6.4 Checkout y pago (`/checkout`)

Flujo completo de compra:

1. El cliente rellena dirección, elige método de envío y aplica cupón (opcional).
2. Al confirmar, se llama a `/api/create-checkout-session` que:
   - **Valida los precios desde la BD** (no acepta precios del frontend).
   - **Valida el coste de envío desde la BD**.
   - **Valida el cupón server-side**.
   - Crea una sesión de Stripe Checkout con los datos verificados.
3. El cliente es redirigido a la página de pago de Stripe.
4. Tras el pago exitoso, Stripe redirige a `/checkout/success` que llama a `/api/confirm-payment`.
5. `confirm-payment` verifica con Stripe que el pago realmente se completó, crea el pedido en BD, genera la factura y envía el email de confirmación.

**Métodos de pago aceptados**: Tarjeta de crédito/débito (vía Stripe).

### 6.5 Métodos de envío

| Método | Precio | Plazo |
|---|---|---|
| Envío Estándar | 4,99 € | 57 días laborables |
| Envío Express | 9,99 € | 2448 horas (pedido mínimo 30 €) |
| Recogida en tienda | Gratis | 1 día |

### 6.6 Perfil y mis pedidos (`/perfil`)

El cliente puede:
- Ver y editar sus datos personales.
- Consultar el historial completo de pedidos con estado en tiempo real.
- Acceder a la factura de cada pedido.
- Iniciar una solicitud de devolución para pedidos entregados (plazo de 30 días).

### 6.7 Lista de deseos (`/favoritos`)

- Guarda productos favoritos (requiere estar registrado).
- El sistema notifica automáticamente al usuario si un producto en su lista baja de stock o entra en oferta.

### 6.8 Devoluciones

El cliente solicita una devolución desde su perfil. El sistema:
1. Genera un número de devolución único (`RET-XXXXX`).
2. Crea un PDF con etiqueta de envío y código de barras.
3. Envía el PDF por email al cliente para que lo imprima y lo lleve a Correos.
4. Alerta al admin por email de la nueva devolución.

### 6.9 Cuenta de usuario

- Registro con email y contraseña (Supabase Auth).
- Login / logout.
- Recuperación de contraseña por email.
- Direcciones de envío guardadas (autocompletado en checkout).

---

## 7. Panel de administración

Acceso en `/admin/login`. Requiere cuenta en Supabase Auth + registro en la tabla `admin_users`.

### 7.1 Dashboard (`/admin`)

Vista general del negocio en tiempo real:
- Ventas totales del mes, número de pedidos, clientes nuevos, ingresos.
- Gráfico de ventas de los últimos 30 días.
- Actividad reciente (últimos pedidos).
- **Panel de automatización de wishlist**: muestra cuántos usuarios tienen en su lista de deseos productos con stock bajo o en oferta, y permite enviarles las notificaciones manualmente.

### 7.2 Gestión de pedidos (`/admin/pedidos`)

Los pedidos se organizan en tres secciones según el método de envío:

**Envío Express**  Pedidos prioritarios 2448h  
**Envío Estándar**  Pedidos ordinarios  
**Recogida en Tienda**  Pedidos para recoger en local

Dentro de cada sección, los pedidos aparecen ordenados: primero los que requieren acción (`paid`), luego los `listo/enviado`.

**Estados de un pedido**:

| Estado | Significado |
|---|---|
| `paid` | Pagado, pendiente de preparar |
| `ready_for_pickup` | Preparado, listo para recoger en tienda |
| `shipped` | Enviado con número de seguimiento |
| `delivered` | Entregado al cliente |
| `cancelled` | Cancelado (con reembolso automático si aplica) |

**Acciones disponibles desde el panel**:
- Marcar como listo para recoger  envía email al cliente automáticamente.
- Marcar como enviado  introduce transportista y número de seguimiento  envía email al cliente.
- Marcar como entregado.
- Ver detalle completo del pedido (artículos, dirección, factura).
- Historial de pedidos entregados y cancelados con buscador.

### 7.3 Gestión de productos (`/admin/productos`)

- Listado de todos los productos con stock, precio y estado.
- Crear producto nuevo: nombre, descripción, precio, categoría, imágenes (Cloudinary), tallas y stock por talla.
- Editar producto existente.
- Activar / desactivar producto.
- Poner producto en oferta: precio de oferta + fecha de inicio y fin.
- Gestión de tallas: añadir/editar stock por talla.

### 7.4 Gestión de categorías (`/admin/categorias`)

- Crear, editar y eliminar categorías.
- Cada categoría tiene nombre, descripción e imagen.

### 7.5 Devoluciones (`/admin/devoluciones`)

Lista de todas las solicitudes de devolución activas. Para cada una el admin puede:

| Acción | Qué hace |
|---|---|
| Marcar como recibido | El paquete llegó al almacén  email al cliente |
| Marcar como reembolsado | Procesa el reembolso real en Stripe + restaura stock + genera factura rectificativa + envía email con PDF adjunto |
| Rechazar | Envía email al cliente con el motivo |

### 7.6 Facturas (`/admin/facturas`)

- Listado de todas las facturas generadas.
- Vista previa en HTML (igual al PDF que recibe el cliente).
- Descarga de la factura en PDF.
- Creación manual de facturas.

### 7.7 Cupones (`/admin/cupones`)

- Crear códigos de descuento (porcentaje o importe fijo).
- Configurar: número máximo de usos total, usos por cliente, importe mínimo de compra, fecha de expiración.
- Ver estadísticas de uso de cada cupón.

### 7.8 Newsletter (`/admin/newsletter`)

- Lista completa de suscriptores con fecha de alta.
- Redactor de newsletter con editor HTML + vista previa en tiempo real.
- Envío a todos los suscriptores activos.
- El envío se hace en lotes con delay entre emails para respetar los límites de Resend.

### 7.9 Usuarios (`/admin/usuarios`)

- Lista de clientes registrados.
- Información de cada cliente: nombre, email, fecha de registro, número de pedidos.

### 7.10 Tallas (`/admin/tallas`)

- Gestión del sistema de tallas global.
- Guía de tallas que se muestra en la tienda.

### 7.11 Configuración (`/admin/configuracion`)

Configuración general de la aplicación mediante clave-valor en BD:
- Activar/desactivar el popup de newsletter.
- Cambiar el título, subtítulo, descripción del popup y el código promocional que ofrece.
- Ajustar el tiempo de espera en segundos antes de que aparezca el popup.

### 7.12 Preview de emails (`/admin/email-preview`)

Visualización de todos los templates de email en el navegador para revisión sin necesidad de enviarlos.

---

## 8. Sistema de emails

Todos los emails se envían con **Resend** desde `Vantage <onboarding@resend.dev>`.

### Emails al cliente

| Cuándo se envía | Contenido |
|---|---|
| Pedido confirmado | Resumen del pedido, artículos, total, dirección de envío, enlace a la factura |
| Pedido listo para recoger | Aviso de que el pedido está en tienda |
| Pedido enviado | Número de seguimiento y transportista |
| Pedido entregado | Confirmación de entrega |
| Pedido cancelado | Confirmación + importe reembolsado + factura rectificativa en PDF adjunta |
| Devolución creada | Confirmación + etiqueta de devolución en PDF adjunta |
| Devolución recibida | El paquete llegó al almacén, se está revisando |
| Devolución reembolsada | Importe reembolsado + factura rectificativa en PDF adjunta |
| Devolución rechazada | Motivo del rechazo |
| Wishlist  stock bajo | Aviso de que un producto favorito se está agotando |
| Wishlist  oferta | Aviso de que un producto favorito ha entrado en oferta |
| Newsletter | Contenido redactado por el admin |

### Emails al administrador

| Cuándo se envía | Contenido |
|---|---|
| Nuevo pedido | Resumen del pedido con artículos e importe total |
| Stock bajo | Lista de productos/tallas con stock  5 unidades |
| Stock agotado | Lista de productos/tallas con stock = 0 |
| Nueva devolución solicitada | Datos del cliente y artículos a devolver |

---

## 9. Sistema de facturas y PDFs

### Factura estándar

Se genera automáticamente al confirmar el pago. Incluye:
- Datos de la empresa (NIF, dirección, contacto).
- Datos del cliente.
- Tabla de artículos con talla, precio unitario y total.
- Desglose: base imponible, IVA (21%), subtotal, envío, descuento, total.
- Número de factura único (`VNT-YYYY-NNNNN`).

### Factura rectificativa (nota de crédito)

Se genera cuando se cancela un pedido o se aprueba una devolución. Referencia la factura original e indica el importe negativo (a devolver).

### Visualización web vs PDF adjunto

- **Web** (`/pedido/[id]`): la factura se renderiza en HTML con estilos CSS completos en el navegador.
- **Email**: se adjunta un PDF generado con pdfkit que replica el mismo diseño (cabecera navy, logo VANTAGE en dorado, tabla de artículos, totales, pie de página).

### Etiqueta de devolución

El PDF de devolución incluye:
- Número de devolución y datos del cliente.
- Dirección de devoluciones de Vantage.
- Código de barras Code128 imprimible (generado con bwip-js).
- Instrucciones para el envío por Correos.

---

## 10. Seguridad

### Autenticación y autorización

- Las páginas `/admin/*` están protegidas por el middleware: requieren cookie `admin_session` activa + sesión Supabase válida.
- Todos los endpoints `/api/admin/*` verifican la sesión con `verifyAdminRequest()` que crea un cliente Supabase per-request (evita que sesiones concurrentes se mezclen en SSR).
- Los endpoints de cliente (`/api/orders/cancel`, `/api/returns/*`) verifican que el usuario autenticado es el propietario del recurso.

### Validación de pagos

- Los **precios** se leen de la BD en el servidor, nunca se aceptan del frontend.
- El **coste de envío** se lee de la BD según el método seleccionado.
- Los **cupones** se validan server-side (monto mínimo, expiración, usos por usuario).
- Tras el pago, se **verifica con Stripe** que el PaymentIntent realmente tiene estado `succeeded` antes de crear el pedido.
- **Idempotencia**: si el usuario recarga la página de éxito, se detecta el pedido existente y no se crea un duplicado.

### Headers de seguridad

El middleware aplica en todas las respuestas:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (protección contra clickjacking)
- `Strict-Transport-Security` (fuerza HTTPS)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (desactiva cámara, micrófono, geolocalización, etc.)

### Protección de endpoints sensibles

| Endpoint | Protección |
|---|---|
| `/api/admin/*` | `verifyAdminRequest`  sesión admin obligatoria |
| `/api/upload-image` | `verifyAdminRequest`  solo admins pueden subir imágenes |
| `/api/check-stock-alerts` | `verifyAdminRequest`  evita spam de emails hacia el admin |
| `/api/email-preview` | `verifyAdminRequest`  solo visible para admins |
| `/api/stripe-webhook` | Verificación de firma `stripe-signature` de Stripe |

---

## 11. Despliegue

### Con Docker

```bash
docker build -t vantage-fashion .
docker run -p 4321:4321 --env-file .env vantage-fashion
```

### Con nixpacks (Railway, Render, etc.)

El archivo `nixpacks.toml` ya está configurado. Solo conecta el repositorio en la plataforma y añade las variables de entorno.

### Variables de entorno en producción

Todas las variables del apartado 5 deben configurarse en la plataforma de despliegue. **Nunca subir el archivo `.env` al repositorio.**

### Webhook de Stripe en producción

Registrar el webhook en el dashboard de Stripe:
- URL: `https://[tu-dominio]/api/stripe-webhook`
- Eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`
- Copiar el `Signing secret` a la variable `STRIPE_WEBHOOK_SECRET`

---

## 12. Manual de usuario  Admin

### Acceso al panel

1. Ve a `https://[tu-dominio]/admin/login`
2. Introduce tu email y contraseña de administrador.
3. Serás redirigido al dashboard.

### Gestionar un pedido nuevo

1. Entra en **Pedidos** desde el menú lateral.
2. Los pedidos nuevos aparecen en la parte superior de su sección.
3. Prepara el paquete físicamente.
4. Si es **recogida en tienda**: pulsa **"Marcar listo para recoger"**  el cliente recibirá un email automáticamente.
5. Si es **envío**: selecciona el transportista, introduce el número de seguimiento y pulsa **"Marcar como enviado"**  el cliente recibirá un email con el tracking.
6. Cuando se entregue: pulsa **"Marcar entregado"**.

### Procesar una devolución

1. Entra en **Devoluciones** desde el menú lateral.
2. Cuando el paquete llegue al almacén, haz clic en **"Recibido"**  el cliente recibe confirmación.
3. Inspecciona los artículos devueltos.
4. Si todo está correcto: haz clic en **"Reembolsar"** e introduce el importe (puede ser parcial).
   - El sistema procesa el reembolso en Stripe automáticamente.
   - Restaura el stock de los artículos.
   - Genera y envía la factura rectificativa al cliente por email.
5. Si el artículo no cumple las condiciones: haz clic en **"Rechazar"**, escribe el motivo y el cliente recibirá el email.

### Añadir un producto nuevo

1. Entra en **Productos**  botón **"Nuevo producto"**.
2. Rellena: nombre, descripción, precio, categoría.
3. Sube una o varias imágenes (se guardan en Cloudinary automáticamente).
4. Añade las tallas disponibles con su stock inicial.
5. Activa "En oferta" si procede e introduce el precio de oferta.
6. Pulsa **Guardar**.

### Crear un cupón de descuento

1. Entra en **Cupones**  **"Nuevo cupón"**.
2. Introduce el código (ej: `VERANO20`), el tipo (porcentaje o importe fijo) y el valor.
3. Configura opcionalmente: usos máximos totales, usos máximos por cliente, importe mínimo de compra, fecha de expiración.
4. Pulsa **Crear**.

### Enviar un newsletter

1. Entra en **Newsletter**.
2. Escribe el asunto y el contenido HTML del email.
3. Usa la vista previa para revisar el diseño.
4. Pulsa **"Enviar a todos los suscriptores"**.

### Configurar el popup de bienvenida

1. Entra en **Configuración**.
2. Activa o desactiva el popup con el interruptor.
3. Cambia el título, subtítulo, descripción y el código promocional que ofrece.
4. Ajusta el tiempo de espera en segundos.
5. Guarda los cambios  se aplican en tiempo real.

### Notificaciones de wishlist

Desde el **Dashboard**, en la sección "Automatización de Wishlist":
- La columna ámbar muestra usuarios con productos de stock bajo en su lista de deseos.
- La columna rosa muestra usuarios con productos en oferta en su lista de deseos.
- Pulsa **"Enviar notificaciones"** en la columna correspondiente para enviar los emails de aviso.
- El sistema lleva registro de los envíos para no mandar el mismo aviso dos veces.
