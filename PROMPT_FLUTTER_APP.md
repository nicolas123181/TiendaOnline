# Prompt Profesional para Desarrollo de App Flutter - Vantage Fashion

## Contexto del Proyecto

Necesito crear una aplicación móvil completa en Flutter para **VANTAGE**, una tienda e-commerce de moda masculina premium. La aplicación debe replicar EXACTAMENTE todas las funcionalidades de la versión web actual, manteniendo la misma estructura, diseño y comportamiento.

---

## 1. INICIALIZACIÓN DEL PROYECTO

```bash
flutter create vantage_fashion_app --org com.vantage --platforms android,ios
cd vantage_fashion_app
```

### Dependencias Requeridas (pubspec.yaml)

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # Backend & Database
  supabase_flutter: ^2.0.0
  
  # Pagos
  flutter_stripe: ^10.0.0
  
  # State Management
  provider: ^6.1.0
  riverpod: ^2.4.0
  
  # UI & Design
  google_fonts: ^6.1.0
  flutter_svg: ^2.0.9
  cached_network_image: ^3.3.0
  shimmer: ^3.0.0
  lottie: ^2.7.0
  smooth_page_indicator: ^1.1.0
  
  # Navigation
  go_router: ^13.0.0
  
  # Forms & Validation
  flutter_form_builder: ^9.1.1
  form_builder_validators: ^9.1.0
  
  # Storage
  shared_preferences: ^2.2.2
  flutter_secure_storage: ^9.0.0
  
  # HTTP & Networking
  http: ^1.2.0
  dio: ^5.4.0
  
  # PDF Generation & Preview
  pdf: ^3.10.7
  printing: ^5.11.1
  path_provider: ^2.1.2
  
  # Image Handling
  image_picker: ^1.0.7
  flutter_image_compress: ^2.1.0
  
  # QR & Barcodes
  qr_flutter: ^4.1.0
  mobile_scanner: ^3.5.5
  
  # Email & Communication
  url_launcher: ^6.2.3
  share_plus: ^7.2.1
  
  # Notifications
  flutter_local_notifications: ^16.3.2
  firebase_messaging: ^14.7.10
  
  # Utilities
  intl: ^0.19.0
  uuid: ^4.3.3
  collection: ^1.18.0
  equatable: ^2.0.5
  
  # Search & Filtering
  flutter_typeahead: ^5.0.1
  
  # Animations
  animate_do: ^3.1.2
  flutter_animate: ^4.3.0
```

---

## 2. PALETA DE COLORES (EXACTA)

```dart
// lib/config/app_colors.dart

class AppColors {
  // Colores Principales de Marca
  static const Color brandNavy = Color(0xFF1A2744);
  static const Color brandNavyLight = Color(0xFF2D3F5F);
  static const Color brandCharcoal = Color(0xFF36454F);
  static const Color brandGold = Color(0xFFB8860B);
  static const Color brandAmber = Color(0xFFD97706);
  static const Color brandCream = Color(0xFFFAF8F5);
  static const Color brandLeather = Color(0xFF8B4513);
  
  // Colores de Superficie
  static const Color surfacePrimary = Color(0xFFFFFFFF);
  static const Color surfaceSecondary = Color(0xFFF9FAFB);
  static const Color surfaceTertiary = Color(0xFFF3F4F6);
  
  // Colores de Texto
  static const Color textPrimary = Color(0xFF111827);
  static const Color textSecondary = Color(0xFF4B5563);
  static const Color textMuted = Color(0xFF9CA3AF);
  static const Color textInverse = Color(0xFFFFFFFF);
  
  // Colores de Estado
  static const Color success = Color(0xFF059669);
  static const Color error = Color(0xFFDC2626);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF0284C7);
  
  // Colores de Borde
  static const Color borderLight = Color(0xFFE5E7EB);
  static const Color borderMedium = Color(0xFFD1D5DB);
  static const Color borderDark = Color(0xFF9CA3AF);
  
  // Gradientes
  static const LinearGradient brandGradient = LinearGradient(
    colors: [brandNavy, brandNavyLight, brandCharcoal],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  
  static const LinearGradient goldGradient = LinearGradient(
    colors: [brandGold, brandAmber],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
```

---

## 3. ESQUEMA DE BASE DE DATOS SUPABASE

Usa este esquema EXACTO para Supabase:

```sql
-- TABLA: admin_users
CREATE TABLE public.admin_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR NOT NULL UNIQUE,
  role VARCHAR DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: app_settings
CREATE TABLE public.app_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: categories
CREATE TABLE public.categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: products
CREATE TABLE public.products (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL UNIQUE,
  description TEXT,
  price INTEGER NOT NULL CHECK (price > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id INTEGER REFERENCES public.categories(id),
  images TEXT[] DEFAULT '{}',
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sale_price INTEGER CHECK (sale_price IS NULL OR sale_price > 0),
  is_on_sale BOOLEAN DEFAULT FALSE,
  sale_ends_at TIMESTAMPTZ
);

-- TABLA: product_sizes
CREATE TABLE public.product_sizes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES public.products(id),
  size VARCHAR NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: coupons
CREATE TABLE public.coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  discount_type VARCHAR NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value INTEGER NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  min_purchase INTEGER,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  max_uses_per_user INTEGER
);

-- TABLA: shipping_methods
CREATE TABLE public.shipping_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  cost INTEGER NOT NULL,
  min_days INTEGER NOT NULL,
  max_days INTEGER NOT NULL,
  min_order_amount INTEGER,
  max_weight_grams INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: shipping_carriers
CREATE TABLE public.shipping_carriers (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  code VARCHAR NOT NULL UNIQUE,
  tracking_url_template VARCHAR,
  logo_url VARCHAR,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: orders
CREATE TABLE public.orders (
  id SERIAL PRIMARY KEY,
  customer_email VARCHAR NOT NULL,
  customer_name VARCHAR NOT NULL,
  customer_address TEXT NOT NULL,
  customer_city VARCHAR NOT NULL,
  customer_postal_code VARCHAR NOT NULL,
  customer_phone VARCHAR,
  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled')),
  total INTEGER NOT NULL,
  stripe_payment_intent_id VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  discount INTEGER DEFAULT 0,
  subtotal INTEGER,
  shipping_cost INTEGER DEFAULT 0,
  shipping_method_id INTEGER,
  carrier_id INTEGER REFERENCES public.shipping_carriers(id),
  tracking_number VARCHAR
);

-- TABLA: order_items
CREATE TABLE public.order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES public.orders(id),
  product_id INTEGER REFERENCES public.products(id),
  product_name VARCHAR NOT NULL,
  product_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  size VARCHAR
);

-- TABLA: invoices
CREATE TABLE public.invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR NOT NULL UNIQUE,
  order_id INTEGER NOT NULL REFERENCES public.orders(id),
  customer_name VARCHAR NOT NULL,
  customer_email VARCHAR NOT NULL,
  customer_address TEXT,
  customer_city VARCHAR,
  customer_postal_code VARCHAR,
  customer_phone VARCHAR,
  company_name VARCHAR DEFAULT 'Vantage Fashion S.L.',
  company_address TEXT DEFAULT 'Calle de la Moda 123, 28001 Madrid',
  company_nif VARCHAR DEFAULT 'B-12345678',
  company_email VARCHAR DEFAULT 'contacto@vantage.com',
  company_phone VARCHAR DEFAULT '+34 900 123 456',
  subtotal INTEGER NOT NULL,
  shipping_cost INTEGER DEFAULT 0,
  discount INTEGER DEFAULT 0,
  tax_rate NUMERIC DEFAULT 21.00,
  tax_amount INTEGER NOT NULL,
  total INTEGER NOT NULL,
  payment_method VARCHAR DEFAULT 'Tarjeta de crédito',
  payment_status VARCHAR DEFAULT 'paid',
  issue_date TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  status VARCHAR DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'sent', 'paid', 'cancelled')),
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: invoice_items
CREATE TABLE public.invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES public.invoices(id),
  product_id INTEGER REFERENCES public.products(id),
  product_name VARCHAR NOT NULL,
  product_sku VARCHAR,
  product_size VARCHAR,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  discount_percent NUMERIC DEFAULT 0,
  line_total INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: returns
CREATE TABLE public.returns (
  id SERIAL PRIMARY KEY,
  return_number VARCHAR NOT NULL UNIQUE,
  order_id INTEGER NOT NULL REFERENCES public.orders(id),
  customer_email VARCHAR NOT NULL,
  customer_name VARCHAR NOT NULL,
  reason VARCHAR NOT NULL,
  reason_details TEXT,
  items JSONB NOT NULL,
  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'received', 'refunded', 'rejected')),
  refund_amount INTEGER,
  tracking_number VARCHAR,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  received_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  stripe_refund_id VARCHAR
);

-- TABLA: wishlist
CREATE TABLE public.wishlist (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  product_id INTEGER NOT NULL REFERENCES public.products(id),
  size VARCHAR NOT NULL,
  notified_low_stock BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified_sale BOOLEAN DEFAULT FALSE
);

-- TABLA: user_shipping_addresses
CREATE TABLE public.user_shipping_addresses (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  address TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: newsletter_subscribers
CREATE TABLE public.newsletter_subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR NOT NULL UNIQUE,
  name VARCHAR,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);
```

---

## 4. ESTRUCTURA COMPLETA DE LA APP

```
lib/
├── main.dart
├── app.dart
│
├── config/
│   ├── app_colors.dart
│   ├── app_theme.dart
│   ├── app_constants.dart
│   ├── app_routes.dart
│   └── supabase_config.dart
│
├── core/
│   ├── services/
│   │   ├── supabase_service.dart
│   │   ├── stripe_service.dart
│   │   ├── storage_service.dart
│   │   ├── notification_service.dart
│   │   └── pdf_service.dart
│   ├── utils/
│   │   ├── validators.dart
│   │   ├── formatters.dart
│   │   ├── helpers.dart
│   │   └── extensions.dart
│   └── constants/
│       ├── api_endpoints.dart
│       └── app_strings.dart
│
├── data/
│   ├── models/
│   │   ├── product.dart
│   │   ├── category.dart
│   │   ├── order.dart
│   │   ├── order_item.dart
│   │   ├── cart_item.dart
│   │   ├── coupon.dart
│   │   ├── invoice.dart
│   │   ├── return.dart
│   │   ├── wishlist.dart
│   │   ├── shipping_address.dart
│   │   ├── shipping_method.dart
│   │   └── user_profile.dart
│   ├── repositories/
│   │   ├── product_repository.dart
│   │   ├── category_repository.dart
│   │   ├── order_repository.dart
│   │   ├── auth_repository.dart
│   │   ├── cart_repository.dart
│   │   ├── coupon_repository.dart
│   │   ├── invoice_repository.dart
│   │   ├── return_repository.dart
│   │   └── wishlist_repository.dart
│   └── providers/
│       ├── auth_provider.dart
│       ├── cart_provider.dart
│       ├── product_provider.dart
│       ├── order_provider.dart
│       ├── wishlist_provider.dart
│       └── theme_provider.dart
│
├── presentation/
│   ├── screens/
│   │   ├── splash/
│   │   │   └── splash_screen.dart
│   │   ├── auth/
│   │   │   ├── login_screen.dart
│   │   │   ├── register_screen.dart
│   │   │   ├── forgot_password_screen.dart
│   │   │   └── reset_password_screen.dart
│   │   ├── home/
│   │   │   ├── home_screen.dart
│   │   │   └── widgets/
│   │   ├── products/
│   │   │   ├── product_list_screen.dart
│   │   │   ├── product_detail_screen.dart
│   │   │   ├── category_screen.dart
│   │   │   └── widgets/
│   │   ├── cart/
│   │   │   ├── cart_screen.dart
│   │   │   └── checkout_screen.dart
│   │   ├── orders/
│   │   │   ├── order_list_screen.dart
│   │   │   ├── order_detail_screen.dart
│   │   │   └── order_tracking_screen.dart
│   │   ├── profile/
│   │   │   ├── profile_screen.dart
│   │   │   ├── edit_profile_screen.dart
│   │   │   ├── addresses_screen.dart
│   │   │   └── add_address_screen.dart
│   │   ├── wishlist/
│   │   │   └── wishlist_screen.dart
│   │   ├── returns/
│   │   │   ├── create_return_screen.dart
│   │   │   └── return_detail_screen.dart
│   │   ├── invoices/
│   │   │   ├── invoice_list_screen.dart
│   │   │   └── invoice_detail_screen.dart
│   │   ├── search/
│   │   │   └── search_screen.dart
│   │   └── info/
│   │       ├── about_screen.dart
│   │       ├── size_guide_screen.dart
│   │       ├── shipping_info_screen.dart
│   │       ├── privacy_screen.dart
│   │       └── terms_screen.dart
│   │
│   └── widgets/
│       ├── common/
│       │   ├── app_bar_custom.dart
│       │   ├── bottom_nav_bar.dart
│       │   ├── custom_button.dart
│       │   ├── custom_text_field.dart
│       │   ├── loading_indicator.dart
│       │   ├── error_widget.dart
│       │   ├── empty_state.dart
│       │   └── image_carousel.dart
│       ├── product/
│       │   ├── product_card.dart
│       │   ├── product_grid.dart
│       │   ├── product_list_item.dart
│       │   ├── size_selector.dart
│       │   └── add_to_cart_button.dart
│       ├── cart/
│       │   ├── cart_item_widget.dart
│       │   └── coupon_input.dart
│       └── order/
│           ├── order_card.dart
│           ├── order_status_badge.dart
│           └── tracking_timeline.dart
│
└── admin/ (Panel de Administración - WEB Y MÓVIL)
    ├── screens/
    │   ├── admin_dashboard.dart
    │   ├── admin_login_screen.dart
    │   ├── products/
    │   │   ├── manage_products_screen.dart
    │   │   ├── add_product_screen.dart
    │   │   ├── edit_product_screen.dart
    │   │   └── product_stock_screen.dart
    │   ├── orders/
    │   │   ├── manage_orders_screen.dart
    │   │   ├── order_detail_admin_screen.dart
    │   │   └── update_order_status_screen.dart
    │   ├── returns/
    │   │   ├── manage_returns_screen.dart
    │   │   ├── return_detail_admin_screen.dart
    │   │   └── process_return_screen.dart
    │   ├── invoices/
    │   │   ├── manage_invoices_screen.dart
    │   │   └── edit_invoice_screen.dart
    │   ├── coupons/
    │   │   ├── manage_coupons_screen.dart
    │   │   ├── add_coupon_screen.dart
    │   │   └── edit_coupon_screen.dart
    │   ├── categories/
    │   │   ├── manage_categories_screen.dart
    │   │   └── add_edit_category_screen.dart
    │   ├── newsletter/
    │   │   ├── newsletter_subscribers_screen.dart
    │   │   └── send_newsletter_screen.dart
    │   ├── shipping/
    │   │   ├── shipping_methods_screen.dart
    │   │   └── shipping_carriers_screen.dart
    │   └── settings/
    │       ├── app_settings_screen.dart
    │       └── admin_users_screen.dart
    └── widgets/
        ├── admin_stats_card.dart
        ├── admin_chart.dart
        ├── order_quick_actions.dart
        └── return_quick_actions.dart
```

---

## 5. FUNCIONALIDADES COMPLETAS REQUERIDAS

### 5.1 Autenticación y Usuario (CLIENTE)
- ✅ Registro con email/contraseña (Supabase Auth)
- ✅ Login con email/contraseña
- ✅ Recuperación de contraseña
- ✅ Restablecer contraseña
- ✅ Perfil de usuario editable
- ✅ Gestión de direcciones de envío (múltiples direcciones, marcar como predeterminada)
- ✅ Cerrar sesión

### 5.2 Catálogo de Productos
- ✅ Listado de productos con paginación infinita
- ✅ Filtrado por categorías
- ✅ Búsqueda en tiempo real (LiveSearch)
- ✅ Productos destacados en home
- ✅ Productos en oferta (sale_price, is_on_sale, sale_ends_at)
- ✅ Galería de imágenes del producto (swipeable carousel)
- ✅ Selector de tallas con stock por talla
- ✅ Recomendador de tallas
- ✅ Indicador de stock disponible
- ✅ Vista de producto individual con descripción completa

### 5.3 Carrito de Compra
- ✅ Agregar productos al carrito con talla seleccionada
- ✅ Modificar cantidad de productos
- ✅ Eliminar productos del carrito
- ✅ Persistencia del carrito (localStorage/SharedPreferences)
- ✅ Cálculo automático de subtotal
- ✅ Aplicar cupones de descuento (validación de fecha, usos, monto mínimo)
- ✅ Mostrar descuento aplicado
- ✅ Cálculo de envío según método seleccionado
- ✅ Total final con IVA (21%)

### 5.4 Checkout y Pagos
- ✅ Formulario de datos de envío (autocompletado si hay dirección guardada)
- ✅ Selector de dirección de envío guardadas
- ✅ Selector de método de envío (standard, express, pickup)
- ✅ Resumen del pedido antes de pagar
- ✅ Integración completa con Stripe Payment Intents
- ✅ Formulario de tarjeta con Stripe Elements
- ✅ Manejo de errores de pago
- ✅ Confirmación de pedido con número de orden
- ✅ Email de confirmación automático

### 5.5 Órdenes
- ✅ Listado de todas las órdenes del usuario
- ✅ Detalle completo de cada orden
- ✅ Estados de orden: pending, paid, ready_for_pickup, shipped, delivered, cancelled
- ✅ Tracking de envío con número de seguimiento
- ✅ Link a página de tracking del carrier
- ✅ Timeline visual del estado del pedido
- ✅ Opción de solicitar devolución desde el detalle de orden

### 5.6 Facturas
- ✅ Generación automática de factura al completar pago
- ✅ Listado de facturas del usuario
- ✅ Vista previa de factura
- ✅ Descarga de factura en PDF
- ✅ Compartir factura (share_plus)
- ✅ Email con factura adjunta

### 5.7 Devoluciones (Returns)
- ✅ Solicitar devolución desde orden entregada
- ✅ Seleccionar productos a devolver
- ✅ Motivos de devolución (no me queda, defectuoso, no es lo esperado, etc.)
- ✅ Detalles adicionales del motivo
- ✅ Generación de número de devolución (RET-XXXXXX)
- ✅ Estados: pending, in_transit, received, refunded, rejected
- ✅ Tracking de devolución
- ✅ Etiqueta de envío de devolución (PDF)
- ✅ Notificaciones por email de cada cambio de estado
- ✅ Reembolso automático a Stripe cuando se aprueba

### 5.8 Wishlist (Lista de Deseos)
- ✅ Agregar productos a wishlist con talla
- ✅ Eliminar de wishlist
- ✅ Ver todos los productos en wishlist
- ✅ Notificación cuando producto en wishlist baja de precio
- ✅ Notificación cuando producto en wishlist tiene stock bajo
- ✅ Botón rápido para agregar al carrito desde wishlist

### 5.9 Newsletter
- ✅ Suscripción a newsletter desde popup o footer
- ✅ Validación de email
- ✅ Confirmación de suscripción
- ✅ Opción de desuscribirse

### 5.10 Información y Legal
- ✅ Página "Sobre Nosotros"
- ✅ Guía de Tallas interactiva
- ✅ Información de Envíos y Devoluciones
- ✅ Política de Privacidad
- ✅ Términos y Condiciones

### 5.11 Notificaciones
- ✅ Notificaciones push (Firebase Cloud Messaging)
- ✅ Notificación cuando cambia estado de orden
- ✅ Notificación cuando producto de wishlist está en oferta
- ✅ Notificación de confirmación de pago
- ✅ Notificación de envío con tracking

### 5.12 Búsqueda y Filtros
- ✅ Búsqueda en tiempo real con sugerencias
- ✅ Filtros por: categoría, precio (min-max), talla, en oferta
- ✅ Ordenar por: relevancia, precio (asc/desc), más nuevo, más vendido

### 5.13 Dark Mode
- ✅ Soporte completo para modo oscuro
- ✅ Toggle manual en perfil
- ✅ Detección automática del sistema
- ✅ Persistencia de preferencia

---

## 5.14 PANEL DE ADMINISTRACIÓN (CRÍTICO)

### 5.14.1 Autenticación Admin
- ✅ Login exclusivo para administradores (verificación en tabla `admin_users`)
- ✅ Protección de rutas admin (middleware)
- ✅ Roles: admin, super_admin
- ✅ Sesión persistente de admin

### 5.14.2 Dashboard Principal
- ✅ **Estadísticas en tiempo real**:
  - Ventas del día (en €)
  - Ventas del mes
  - Número de pedidos pendientes
  - Número de devoluciones activas
  - Productos con stock bajo (< 5 unidades)
  - Nuevos suscriptores del día
- ✅ **Gráficos**:
  - Ventas por día (últimos 30 días)
  - Productos más vendidos (top 10)
  - Categorías más populares
  - Estado de órdenes (gráfico de dona)
- ✅ **Órdenes recientes**: Lista de últimas 10 órdenes con acciones rápidas
- ✅ **Alertas**: Stock bajo, devoluciones pendientes, cupones por expirar

### 5.14.3 Gestión de Productos
- ✅ **Listar productos**: Tabla con paginación, búsqueda y filtros
- ✅ **Crear producto**:
  - Nombre, slug (auto-generado), descripción
  - Precio, precio de oferta (sale_price)
  - Categoría (selector)
  - Imágenes (múltiples, drag & drop)
  - Marcar como destacado (featured)
  - Activar oferta (is_on_sale, sale_ends_at)
  - Stock por talla (tabla dinámica)
- ✅ **Editar producto**: Todos los campos editables
- ✅ **Eliminar producto**: Confirmación antes de borrar
- ✅ **Gestión de stock por talla**:
  - Ver stock actual de cada talla
  - Ajustar stock manualmente
  - Historial de cambios de stock
- ✅ **Bulk actions**: Activar/desactivar múltiples productos

### 5.14.4 Gestión de Categorías
- ✅ **Listar categorías**: Todas las categorías con contador de productos
- ✅ **Crear categoría**: Nombre, slug, descripción
- ✅ **Editar categoría**: Modificar nombre, slug, descripción
- ✅ **Eliminar categoría**: Solo si no tiene productos asociados
- ✅ **Reordenar categorías**: Cambiar orden de visualización

### 5.14.5 Gestión de Órdenes
- ✅ **Listar órdenes**: Tabla con todos los pedidos
- ✅ **Filtros avanzados**:
  - Por estado (pending, paid, shipped, delivered, cancelled)
  - Por rango de fechas
  - Por monto (min-max)
  - Por email de cliente
- ✅ **Detalle de orden**:
  - Información completa del cliente
  - Productos ordenados con cantidades
  - Totales (subtotal, descuento, envío, IVA, total)
  - Historial de cambios de estado
  - Método de pago usado
- ✅ **Actualizar estado de orden**:
  - Cambiar de `paid` a `ready_for_pickup` o `shipped`
  - Cambiar de `shipped` a `delivered`
  - Cancelar orden (con confirmación)
  - Al cambiar a `shipped`: ingresar número de tracking y carrier
  - **Envío automático de email** al cliente en cada cambio de estado
- ✅ **Imprimir factura**: Botón para generar/descargar factura PDF
- ✅ **Ver factura asociada**: Link a la factura de la orden
- ✅ **Exportar órdenes**: CSV/Excel con filtros aplicados

### 5.14.6 Gestión de Devoluciones
- ✅ **Listar devoluciones**: Todas las solicitudes de devolución
- ✅ **Filtros**:
  - Por estado (pending, in_transit, received, refunded, rejected)
  - Por fecha de solicitud
  - Por email de cliente
- ✅ **Detalle de devolución**:
  - Número de devolución (RET-XXXXXX)
  - Orden original asociada
  - Productos a devolver
  - Motivo de devolución
  - Detalles adicionales del cliente
  - Fotos adjuntas (si las hay)
  - Notas del admin (campo editable)
- ✅ **Procesar devolución**:
  - Cambiar estado a `in_transit`: Cliente envió el paquete
  - Cambiar estado a `received`: Paquete recibido en almacén
  - **Aprobar devolución** (estado `refunded`):
    - Ingresar monto a reembolsar (puede ser parcial)
    - **Ejecutar reembolso automático a Stripe**
    - **Restaurar stock** de los productos devueltos
    - Enviar email de confirmación al cliente
  - **Rechazar devolución** (estado `rejected`):
    - Ingresar motivo del rechazo
    - Enviar email al cliente con explicación
- ✅ **Generar etiqueta de envío**: PDF con código QR para devolución
- ✅ **Historial de comunicaciones**: Ver todos los emails enviados

### 5.14.7 Gestión de Facturas
- ✅ **Listar facturas**: Todas las facturas generadas
- ✅ **Filtros**:
  - Por estado (draft, issued, sent, paid, cancelled)
  - Por fecha de emisión
  - Por cliente
  - Por monto
- ✅ **Ver/Editar factura**:
  - Información del cliente (editable)
  - Información de la empresa (configurable)
  - Items de la factura
  - Subtotal, descuento, envío, IVA, total
  - Notas adicionales
  - Estado de pago
- ✅ **Regenerar PDF**: Si se edita la factura
- ✅ **Enviar factura por email**: Botón para reenviar
- ✅ **Marcar como pagada/cancelada**
- ✅ **Exportar facturas**: Reporte en PDF/CSV

### 5.14.8 Gestión de Cupones
- ✅ **Listar cupones**: Todos los cupones con estado
- ✅ **Crear cupón**:
  - Código (único, uppercase)
  - Tipo de descuento: percentage o fixed
  - Valor del descuento
  - Fecha de inicio y fin
  - Máximo de usos totales (opcional)
  - Máximo de usos por usuario (opcional)
  - Monto mínimo de compra (opcional)
  - Activar/desactivar
- ✅ **Editar cupón**: Todos los campos editables
- ✅ **Desactivar cupón**: Toggle para desactivar sin borrar
- ✅ **Ver estadísticas de uso**:
  - Número de veces usado
  - Total ahorrado por clientes
  - Órdenes que lo usaron
- ✅ **Eliminar cupón**: Con confirmación

### 5.14.9 Newsletter
- ✅ **Listar suscriptores**: Todos los emails suscritos
- ✅ **Ver detalles**: Fecha de suscripción, estado (activo/inactivo)
- ✅ **Exportar lista**: CSV con todos los emails
- ✅ **Enviar newsletter masivo**:
  - Editor de texto enriquecido (WYSIWYG)
  - Campo de asunto
  - Vista previa del email
  - Envío de prueba (a email del admin)
  - **Envío masivo a todos los suscriptores activos**
  - Template de email profesional con logo y colores de marca
- ✅ **Historial de newsletters enviados**

### 5.14.10 Métodos de Envío
- ✅ **Listar métodos**: Standard, Express, Pickup, etc.
- ✅ **Crear método de envío**:
  - Nombre
  - Descripción
  - Costo (en centavos)
  - Días mínimos y máximos de entrega
  - Monto mínimo para activarse (opcional)
  - Peso máximo soportado (opcional)
  - Activar/desactivar
  - Orden de visualización
- ✅ **Editar método de envío**
- ✅ **Eliminar método**: Si no está en uso

### 5.14.11 Transportistas (Carriers)
- ✅ **Listar transportistas**: Correos, SEUR, MRW, etc.
- ✅ **Crear transportista**:
  - Nombre
  - Código (único)
  - Template de URL de tracking (con {tracking_number})
  - Logo (upload)
  - Activar/desactivar
- ✅ **Editar transportista**
- ✅ **Eliminar transportista**: Si no está en uso

### 5.14.12 Configuración General
- ✅ **App Settings** (tabla `app_settings`):
  - IVA por defecto (21%)
  - Monto mínimo para envío gratis (€50)
  - Email de contacto
  - Teléfono de contacto
  - Dirección de la empresa
  - Habilitar/deshabilitar registro de usuarios
  - Habilitar/deshabilitar modo mantenimiento
  - Banner de promoción en home (texto y link)
- ✅ **Gestión de Admins**:
  - Listar usuarios admin
  - Agregar nuevo admin (email)
  - Cambiar rol (admin, super_admin)
  - Eliminar admin
- ✅ **Información de la empresa** (para facturas):
  - Razón social
  - CIF/NIF
  - Dirección
  - Email
  - Teléfono

### 5.14.13 Reportes y Analíticas
- ✅ **Ventas por período**:
  - Hoy, ayer, últimos 7 días, últimos 30 días, mes actual, año actual
  - Selector de rango de fechas personalizado
  - Gráfico de líneas de ventas diarias
  - Total de ventas en €
  - Número de órdenes
  - Ticket promedio
- ✅ **Productos más vendidos**:
  - Top 10/20/50 productos
  - Unidades vendidas
  - Ingresos generados
- ✅ **Clientes frecuentes**:
  - Top clientes por número de órdenes
  - Top clientes por monto gastado
- ✅ **Análisis de cupones**:
  - Cupones más usados
  - Descuentos otorgados
  - Impacto en ventas
- ✅ **Exportar reportes**: PDF o Excel

### 5.14.14 Notificaciones Admin
- ✅ **Notificaciones en tiempo real**:
  - Nueva orden recibida
  - Nueva devolución solicitada
  - Stock bajo en producto
  - Cupón próximo a expirar
- ✅ **Badge de contador**: En iconos del admin panel
- ✅ **Centro de notificaciones**: Lista de todas las notificaciones

### 5.14.15 Acciones Rápidas (Quick Actions)
- ✅ Desde el dashboard:
  - Marcar orden como `shipped` directamente
  - Aprobar/rechazar devolución con un clic
  - Ver detalles de orden en modal rápido
  - Cambiar stock de producto rápidamente
- ✅ Búsqueda global en admin:
  - Buscar órdenes por número o email
  - Buscar productos por nombre o SKU
  - Buscar clientes por email

---

## 6. DISEÑO Y UX (REQUERIMIENTOS EXACTOS)

### 6.1 Tipografía
```dart
// lib/config/app_theme.dart

TextTheme get _textTheme => TextTheme(
  // Títulos grandes - Logo, Hero
  displayLarge: GoogleFonts.playfairDisplay(
    fontSize: 48,
    fontWeight: FontWeight.w300,
    letterSpacing: 8,
    color: AppColors.brandNavy,
  ),
  displayMedium: GoogleFonts.playfairDisplay(
    fontSize: 36,
    fontWeight: FontWeight.w300,
    letterSpacing: 6,
    color: AppColors.brandNavy,
  ),
  
  // Títulos de sección
  headlineLarge: GoogleFonts.inter(
    fontSize: 32,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  ),
  headlineMedium: GoogleFonts.inter(
    fontSize: 24,
    fontWeight: FontWeight.w500,
    color: AppColors.textPrimary,
  ),
  
  // Cuerpo de texto
  bodyLarge: GoogleFonts.inter(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimary,
  ),
  bodyMedium: GoogleFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
  ),
  
  // Botones y labels
  labelLarge: GoogleFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 1.5,
    color: AppColors.textInverse,
  ),
);
```

### 6.2 Componentes UI Clave

#### Botón Principal
```dart
// Estilo premium con bordes rectos, sin border radius
Container(
  decoration: BoxDecoration(
    color: AppColors.brandNavy,
    borderRadius: BorderRadius.zero, // Sin redondeo
  ),
  padding: EdgeInsets.symmetric(vertical: 16, horizontal: 32),
  child: Text(
    'AÑADIR AL CARRITO',
    style: TextStyle(
      letterSpacing: 2,
      fontWeight: FontWeight.w600,
    ),
  ),
)
```

#### Card de Producto
```dart
// Diseño minimalista, elegante, con sombra sutil
Container(
  decoration: BoxDecoration(
    color: Colors.white,
    boxShadow: [
      BoxShadow(
        color: Colors.black.withOpacity(0.05),
        blurRadius: 10,
        offset: Offset(0, 4),
      ),
    ],
  ),
  child: Column(
    children: [
      // Imagen del producto
      AspectRatio(aspectRatio: 3/4),
      // Nombre del producto
      // Precio con formato €XX,XX
      // Indicador de oferta si aplica
    ],
  ),
)
```

### 6.3 Animaciones
- ✅ Fade in al cargar pantallas
- ✅ Slide transitions en navegación
- ✅ Hero animations en imágenes de productos
- ✅ Shimmer loading para cards
- ✅ Animación del carrito al agregar producto
- ✅ Smooth scroll en listas

---

## 7. INTEGRACIONES CRÍTICAS

### 7.1 Supabase
```dart
// lib/config/supabase_config.dart

import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseConfig {
  static const String supabaseUrl = 'TU_SUPABASE_URL';
  static const String supabaseAnonKey = 'TU_SUPABASE_ANON_KEY';
  
  static Future<void> initialize() async {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
    );
  }
  
  static SupabaseClient get client => Supabase.instance.client;
}
```

### 7.2 Stripe
```dart
// lib/core/services/stripe_service.dart

class StripeService {
  static const String publishableKey = 'TU_STRIPE_PUBLISHABLE_KEY';
  
  Future<void> initialize() async {
    Stripe.publishableKey = publishableKey;
  }
  
  Future<Map<String, dynamic>> createPaymentIntent({
    required int amount, // en centavos
    required String currency,
  }) async {
    // Llamada a tu Cloud Function o API de Supabase
    final response = await Dio().post(
      'TU_API_URL/create-payment-intent',
      data: {
        'amount': amount,
        'currency': currency,
      },
    );
    return response.data;
  }
  
  Future<bool> confirmPayment(String clientSecret) async {
    try {
      await Stripe.instance.confirmPayment(
        paymentIntentClientSecret: clientSecret,
      );
      return true;
    } catch (e) {
      return false;
    }
  }
}
```

---

## 8. REGLAS DE NEGOCIO CRÍTICAS

### 8.1 Cupones
- Validar que el cupón esté activo (`is_active = true`)
- Validar fecha de inicio y fin
- Validar número máximo de usos (`used_count < max_uses`)
- Validar usos por usuario (`max_uses_per_user`)
- Validar monto mínimo de compra (`min_purchase`)
- Aplicar descuento según tipo:
  - `percentage`: `descuento = (subtotal * discount_value) / 100`
  - `fixed`: `descuento = discount_value` (en centavos)

### 8.2 Stock
- Verificar stock por talla antes de agregar al carrito
- Reducir stock al confirmar pago
- Restaurar stock si se cancela orden
- Restaurar stock si se aprueba devolución
- Mostrar "Agotado" si stock = 0

### 8.3 Precios
- TODOS los precios se guardan en centavos (ej: 50€ = 5000)
- Formatear en UI: `€50,00`
- IVA: 21% sobre subtotal (después de descuento)
- Envío gratuito si subtotal > 50€ (50000 centavos)

### 8.4 Estados de Orden
```
pending → paid → ready_for_pickup / shipped → delivered
                           ↓
                      cancelled
```

### 8.5 Estados de Devolución
```
pending → in_transit → received → refunded
                          ↓
                      rejected
```

---

## 9. FORMATOS Y VALIDACIONES

### 9.1 Formato de Precios
```dart
String formatPrice(int cents) {
  return '€${(cents / 100).toStringAsFixed(2).replaceAll('.', ',')}';
}
```

### 9.2 Número de Factura
```dart
String generateInvoiceNumber() {
  final year = DateTime.now().year;
  final random = Random().nextInt(999999).toString().padLeft(6, '0');
  return 'INV-$year-$random';
}
```

### 9.3 Número de Devolución
```dart
String generateReturnNumber() {
  final random = Random().nextInt(999999).toString().padLeft(6, '0');
  return 'RET-$random';
}
```

### 9.4 Validación de Email
```dart
bool isValidEmail(String email) {
  return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
}
```

### 9.5 Validación de Código Postal (España)
```dart
bool isValidPostalCode(String postalCode) {
  return RegExp(r'^[0-9]{5}$').hasMatch(postalCode);
}
```

---

## 10. EMAILS TRANSACCIONALES

La app debe enviar emails automáticos (via Supabase Edge Functions o servicio externo):

1. **Confirmación de registro**
2. **Confirmación de pedido** (con detalles y factura PDF)
3. **Pedido listo para recoger** (`ready_for_pickup`)
4. **Pedido enviado** (con tracking)
5. **Pedido entregado** (con solicitud de review)
6. **Devolución creada** (con etiqueta PDF)
7. **Devolución recibida** (confirmación de recepción)
8. **Reembolso procesado**
9. **Devolución rechazada** (con motivo)

---

## 11. PANTALLAS PRINCIPALES (Descripción Visual)

### Home Screen
- App Bar con logo VANTAGE (letras espaciadas)
- Barra de búsqueda
- Slider de banners promocionales
- Sección "Productos Destacados" (grid 2 columnas)
- Sección "En Oferta" (horizontal scroll)
- Sección "Nuevos Productos"
- Bottom Navigation Bar: Home, Categorías, Carrito, Favoritos, Perfil

### Product Detail Screen
- Galería de imágenes (swipeable, indicadores de página)
- Nombre del producto (grande, elegante)
- Precio (grande, dorado si en oferta)
- Selector de tallas (chips horizontales)
- Stock disponible por talla
- Botón "AÑADIR AL CARRITO" (full width, navy)
- Botón de favoritos (corazón outline)
- Descripción expandible
- Link a guía de tallas

### Cart Screen
- Lista de productos en carrito
- Cada item: imagen, nombre, talla, precio, quantity selector, botón eliminar
- Input para cupón de descuento
- Resumen: Subtotal, Descuento, Envío, IVA, Total
- Botón "PROCEDER AL PAGO"

### Checkout Screen
- Stepper: 1) Envío, 2) Método de Envío, 3) Pago
- Formulario de dirección o selector de dirección guardada
- Selector de método de envío (cards con precio y tiempo)
- Stripe Payment Form
- Botón "PAGAR €XX,XX"

### Order Detail Screen
- Número de orden destacado
- Estado con badge de color
- Timeline de estados
- Tracking info si está enviado
- Detalles del cliente
- Lista de productos
- Totales
- Botón "SOLICITAR DEVOLUCIÓN" (si está delivered)
- Botón "VER FACTURA"

---

## 12. REQUISITOS TÉCNICOS ADICIONALES

- ✅ **Offline First**: Cachear productos vistos recientemente
- ✅ **Performance**: Lazy loading de imágenes, paginación
- ✅ **Seguridad**: Validación en backend (RLS policies en Supabase)
- ✅ **Error Handling**: Manejo elegante de errores de red
- ✅ **Loading States**: Skeletons y loaders en todas las operaciones async
- ✅ **Responsiveness**: Adaptar a tablets (hasta 3 columnas en grid)
- ✅ **Accesibilidad**: Semantic labels, contraste de colores
- ✅ **Testing**: Unit tests para utils y models

---

## 13. INSTRUCCIONES FINALES

### Estilo de Código
- Usar arquitectura limpia (Clean Architecture)
- Separación clara de capas: data, domain, presentation
- Estado global con Riverpod
- Nombrado en español para models y variables de negocio
- Comentarios en español para funcionalidades de negocio

### Generación Paso a Paso
Por favor, genera la app completa siguiendo este orden:
1. **Setup inicial**: `flutter create`, pubspec.yaml, estructura de carpetas
2. **Config**: Colores, tema, rutas, constantes
3. **Models**: Todos los modelos de datos
4. **Services**: Supabase, Stripe, Storage
5. **Repositories**: Implementación de acceso a datos
6. **Providers**: Estado global
7. **Screens**: Todas las pantallas en orden de importancia
8. **Widgets**: Componentes reutilizables
9. **Testing**: Tests básicos

### No Olvides
- ✅ Incluir assets (logo, placeholder images)
- ✅ Configurar Android y iOS (permisos, configuraciones)
- ✅ README.md con instrucciones de setup
- ✅ .env.example para las keys
- ✅ Instrucciones de deployment

---

## 14. DATOS DE EJEMPLO PARA TESTING

Crea seeders con:
- 5 categorías (Camisas, Pantalones, Abrigos, Camisetas, Chalecos)
- 20 productos de ejemplo con imágenes de placeholder
- 3 métodos de envío (Standard €4,99 / 3-5 días, Express €9,99 / 24-48h, Pickup Gratis / Mismo día)
- 3 transportistas (Correos, SEUR, MRW)
- 2 cupones de prueba (BIENVENIDO10 - 10% descuento, VERANO20 - 20% descuento)
- 1 usuario admin de prueba (admin@fashionshop.com / 123123)
- 5 órdenes de ejemplo en diferentes estados
- 2 devoluciones de ejemplo (1 pending, 1 received)
- 10 suscriptores de newsletter

---

## 15. PERMISOS Y CONFIGURACIONES

### Android (android/app/src/main/AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

### iOS (ios/Runner/Info.plist)
```xml
<key>NSCameraUsageDescription</key>
<string>Necesitamos acceso a la cámara para escanear códigos QR</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Necesitamos acceso a la galería para subir imágenes de productos</string>
```

---

## 16. VARIABLES DE ENTORNO (.env.example)

```env
# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_aqui

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx

# Firebase (para notificaciones)
FIREBASE_PROJECT_ID=vantage-fashion
FIREBASE_SENDER_ID=123456789

# Opcional
API_BASE_URL=https://api.vantage.com
```

---

## CONFIRMACIÓN

¿Entiendes todos los requisitos? ¿Necesitas alguna aclaración antes de empezar a generar el código de la app completa?

La app debe ser:
- **Profesional** y lista para producción
- **Elegante** y premium en diseño
- **100% funcional** con todas las features descritas (CLIENTE Y ADMIN)
- **Bien estructurada** y mantenible
- **Optimizada** para performance

### Funcionalidades CRÍTICAS que NO pueden faltar:
1. ✅ **Todo el flujo de compra**: Productos → Carrito → Checkout → Pago Stripe → Confirmación
2. ✅ **Gestión completa de órdenes**: Estados, tracking, emails automáticos
3. ✅ **Sistema de devoluciones completo**: Solicitud → Procesamiento → Reembolso Stripe
4. ✅ **Facturas automáticas**: Generación, PDF, email
5. ✅ **Cupones con validaciones**: Fechas, usos, monto mínimo
6. ✅ **Wishlist con notificaciones**: Ofertas, stock bajo
7. ✅ **Panel admin completo**: Dashboard, productos, órdenes, devoluciones, cupones, newsletter
8. ✅ **Stock por talla**: Verificación antes de compra, reducción al pagar, restauración al devolver
9. ✅ **Emails transaccionales**: 9 tipos diferentes según acciones
10. ✅ **Dark mode** con persistencia

Comienza con el setup inicial y avanza paso a paso hasta completar TODA la aplicación (frontend cliente + panel admin).

**IMPORTANTE**: El panel admin es IGUAL de crítico que la app del cliente. No es opcional.
