-- ============================================================
-- POLÍTICAS RLS COMPLETAS — VANTAGE FASHION
-- Base de datos: Supabase (PostgreSQL 15+)
-- Fecha: 2026-02-12
-- ============================================================
--
-- ┌─────────────────────────────────────────────────────────┐
-- │              ANÁLISIS DE ARQUITECTURA                   │
-- ├─────────────────────────────────────────────────────────┤
-- │                                                         │
-- │  CLIENTES SUPABASE Y SU NIVEL DE AUTH:                  │
-- │                                                         │
-- │  1. Astro Admin SSR (páginas /admin/*)                  │
-- │     → Cliente: supabase (anon key, SIN JWT de usuario)  │
-- │     → auth.uid() = NULL                                 │
-- │     → auth.role() = 'anon'                              │
-- │     → AFECTADO por RLS como rol 'anon'                  │
-- │                                                         │
-- │  2. Astro Usuario (client-side en browser)              │
-- │     → Cliente: createClient con JWT del usuario         │
-- │     → auth.uid() = UUID del usuario                     │
-- │     → auth.role() = 'authenticated'                     │
-- │     → AFECTADO por RLS como 'authenticated'             │
-- │                                                         │
-- │  3. Astro API con sesión (cancel, returns)              │
-- │     → Cliente: createServerClient(cookies) o            │
-- │       createServerClientFromAuthHeader(header)          │
-- │     → auth.uid() = UUID del usuario                     │
-- │     → auth.role() = 'authenticated'                     │
-- │                                                         │
-- │  4. Astro Service Role (webhooks, pagos, facturas)      │
-- │     → Cliente: getServiceSupabase()                     │
-- │     → BYPASSA completamente el RLS                      │
-- │                                                         │
-- │  5. Flutter App (todas las operaciones)                 │
-- │     → Cliente: Supabase.instance.client con JWT         │
-- │     → auth.uid() = UUID del usuario                     │
-- │     → auth.role() = 'authenticated'                     │
-- │                                                         │
-- ├─────────────────────────────────────────────────────────┤
-- │                                                         │
-- │  RESUMEN DE SEGURIDAD POR TABLA:                        │
-- │                                                         │
-- │  ✅ ESTRICTO (user_id = auth.uid()):                    │
-- │     • wishlist                                          │
-- │     • user_shipping_addresses                           │
-- │                                                         │
-- │  ✅ ESTRICTO (solo service_role escribe):               │
-- │     • admin_users (SELECT público, escritura bloqueada) │
-- │     • shipping_methods (solo lectura)                   │
-- │     • shipping_carriers (solo lectura)                  │
-- │                                                         │
-- │  ✅ PARCIAL (escritura requiere autenticación):         │
-- │     • newsletter_subscribers                            │
-- │     • returns (INSERT requiere autenticación)           │
-- │                                                         │
-- │  ⚠️  PERMISIVO (Astro admin usa cliente anon):          │
-- │     • products, categories, product_sizes               │
-- │     • orders, order_items                               │
-- │     • invoices, invoice_items                           │
-- │     • coupons, coupon_usage                             │
-- │     • app_settings                                      │
-- │                                                         │
-- │  💡 RECOMENDACIÓN FUTURA:                               │
-- │     Migrar páginas admin de Astro para que usen         │
-- │     getServiceSupabase() en lugar del cliente anon.     │
-- │     Esto permitiría restringir escrituras solo a        │
-- │     usuarios admin autenticados (is_admin()).           │
-- │                                                         │
-- └─────────────────────────────────────────────────────────┘
--
-- ============================================================

BEGIN;

-- ============================================================
-- PASO 1: ELIMINAR TODAS LAS POLÍTICAS RLS EXISTENTES
-- ============================================================
-- Elimina dinámicamente TODAS las políticas en el schema public
-- para empezar desde cero sin conflictos.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
  END LOOP;
END
$$;

-- ============================================================
-- PASO 2: FUNCIÓN AUXILIAR is_admin()
-- ============================================================
-- Verifica si el usuario autenticado actual es admin.
-- Útil para futuras restricciones cuando se migre el admin
-- de Astro a usar service_role.
--
-- Retorna FALSE para usuarios anon (sin JWT).
-- SECURITY DEFINER: se ejecuta con permisos del creador,
-- permitiendo leer admin_users sin depender de RLS.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = (auth.jwt() ->> 'email')
  );
$$;

-- ============================================================
-- PASO 3: HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_shipping_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;

-- Tablas opcionales (pueden no existir en todas las instalaciones)
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupon_usage') THEN
    ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_offers') THEN
    ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================
-- PASO 4: GRANTS — PERMISOS DE ACCESO A TABLAS
-- ============================================================
-- Asegurar que los roles anon y authenticated tienen los
-- permisos necesarios sobre cada tabla. Sin GRANT, las queries
-- fallan antes de llegar a evaluar las políticas RLS.

-- Catálogo público (lectura y escritura para admin)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_sizes TO anon, authenticated;

-- Pedidos y facturación
GRANT SELECT, INSERT, UPDATE ON public.orders TO anon, authenticated;
GRANT SELECT, INSERT ON public.order_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoices TO anon, authenticated;
GRANT SELECT, INSERT ON public.invoice_items TO anon, authenticated;

-- Devoluciones
GRANT SELECT, INSERT, UPDATE ON public.returns TO anon, authenticated;

-- Cupones
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO anon, authenticated;

-- Datos de usuario (solo authenticated necesita escribir)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_shipping_addresses TO authenticated;

-- Newsletter (SELECT abierto, escritura solo authenticated)
GRANT SELECT ON public.newsletter_subscribers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.newsletter_subscribers TO authenticated;

-- Admin users (solo lectura, escritura vía service_role)
GRANT SELECT ON public.admin_users TO anon, authenticated;

-- Configuración
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO anon, authenticated;

-- Envío (solo lectura desde la app)
GRANT SELECT ON public.shipping_methods TO anon, authenticated;
GRANT SELECT ON public.shipping_carriers TO anon, authenticated;

-- Secuencias (necesarias para INSERT con auto-increment)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Tablas opcionales
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupon_usage') THEN
    EXECUTE 'GRANT SELECT, INSERT ON public.coupon_usage TO anon, authenticated';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_offers') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_offers TO anon, authenticated';
  END IF;
END $$;

-- ============================================================
-- PASO 5: POLÍTICAS RLS POR TABLA
-- ============================================================

-- ┌─────────────────────────────────────────────────────────┐
-- │ PRODUCTS — Catálogo público                             │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (catálogo visible para cualquier usuario) │
-- │ INSERT: Abierto (admin Astro usa anon)                  │
-- │ UPDATE: Abierto (admin Astro + stock decrements)        │
-- │ DELETE: Abierto (admin Astro usa anon)                  │
-- │                                                         │
-- │ Queries que usan esta tabla:                            │
-- │ • Astro anon: getProducts, getProductBySlug,            │
-- │   getFeaturedProducts, search, admin CRUD               │
-- │ • Astro service_role: confirm-payment stock update      │
-- │ • Flutter auth: catalog browsing, admin CRUD            │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "products_select"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "products_insert"
  ON public.products FOR INSERT
  WITH CHECK (true);

CREATE POLICY "products_update"
  ON public.products FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "products_delete"
  ON public.products FOR DELETE
  USING (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │ CATEGORIES — Categorías públicas                        │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (navegación del catálogo)                 │
-- │ INSERT/UPDATE/DELETE: Abierto (admin Astro usa anon)    │
-- │                                                         │
-- │ Queries: Astro anon (getCategories, admin CRUD),        │
-- │          Flutter auth (catalog, admin CRUD)             │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "categories_select"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "categories_insert"
  ON public.categories FOR INSERT
  WITH CHECK (true);

CREATE POLICY "categories_update"
  ON public.categories FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "categories_delete"
  ON public.categories FOR DELETE
  USING (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │ PRODUCT_SIZES — Tallas y stock                          │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (disponibilidad de tallas en producto)    │
-- │ INSERT/UPDATE/DELETE: Abierto (admin + stock mgmt)      │
-- │                                                         │
-- │ Queries: Astro anon (getProductSizes, admin tallas),    │
-- │   Astro service_role (confirm-payment, cancel stock),   │
-- │   Flutter auth (sizes display, admin sizes)             │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "product_sizes_select"
  ON public.product_sizes FOR SELECT
  USING (true);

CREATE POLICY "product_sizes_insert"
  ON public.product_sizes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "product_sizes_update"
  ON public.product_sizes FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "product_sizes_delete"
  ON public.product_sizes FOR DELETE
  USING (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │ ORDERS — Pedidos                                        │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (admin SSR lee todos, usuario filtra      │
-- │         por email en el cliente)                        │
-- │ INSERT: Abierto (checkout crea pedidos con anon,        │
-- │         confirm-payment usa service_role)               │
-- │ UPDATE: Abierto (admin SSR actualiza estado,            │
-- │         webhooks usan service_role)                     │
-- │                                                         │
-- │ Queries Astro anon: getOrders, admin pedidos/analytics  │
-- │ Queries Astro auth: perfil (email filter), pedido/[id]  │
-- │ Queries Astro service: webhook, cancel, confirm-payment │
-- │ Queries Flutter auth: user orders (email filter), admin │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "orders_select"
  ON public.orders FOR SELECT
  USING (true);

CREATE POLICY "orders_insert"
  ON public.orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │ ORDER_ITEMS — Líneas de pedido                          │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (admin + detalle de pedido usuario)       │
-- │ INSERT: Abierto (se insertan junto con el pedido)       │
-- │ No se necesita UPDATE ni DELETE desde la app            │
-- │                                                         │
-- │ Queries: Astro anon (admin analytics, pedido detail),   │
-- │   Astro service_role (confirm-payment),                 │
-- │   Flutter auth (user order detail, admin)               │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT
  USING (true);

CREATE POLICY "order_items_insert"
  ON public.order_items FOR INSERT
  WITH CHECK (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │ INVOICES — Facturas                                     │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (admin SSR + usuario ve su factura)       │
-- │ INSERT: Abierto (service_role crea, pero fallback anon  │
-- │         en invoice.ts)                                  │
-- │ UPDATE: Abierto (admin SSR actualiza PDF/status)        │
-- │                                                         │
-- │ Queries Astro anon: admin/facturas, api/invoice/[id]    │
-- │ Queries Astro service: createInvoice                    │
-- │ Queries Astro auth: pedido/[id] (usuario ve factura)    │
-- │ Queries Flutter auth: invoice_screen, admin invoices    │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "invoices_select"
  ON public.invoices FOR SELECT
  USING (true);

CREATE POLICY "invoices_insert"
  ON public.invoices FOR INSERT
  WITH CHECK (true);

CREATE POLICY "invoices_update"
  ON public.invoices FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │ INVOICE_ITEMS — Líneas de factura                       │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (admin + usuario descarga factura)        │
-- │ INSERT: Abierto (se crean junto con la factura)         │
-- │                                                         │
-- │ Queries Astro: anon (admin), service (createInvoice)    │
-- │ Queries Flutter: auth (invoice_screen, admin)           │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "invoice_items_select"
  ON public.invoice_items FOR SELECT
  USING (true);

CREATE POLICY "invoice_items_insert"
  ON public.invoice_items FOR INSERT
  WITH CHECK (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │ RETURNS — Devoluciones                                  │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (admin SSR lee todas + usuario las suyas) │
-- │ INSERT: Solo autenticados ✅                            │
-- │   → create-return.ts usa createServerClient (JWT)       │
-- │   → createServerClientFromAuthHeader (Flutter)          │
-- │   → No hay INSERT sin autenticación                     │
-- │ UPDATE: Abierto (admin SSR actualiza estado via anon,   │
-- │         Flutter admin actualiza via authenticated)      │
-- │                                                         │
-- │ Queries Astro anon: admin/devoluciones, update-return   │
-- │ Queries Astro auth: create-return (server client)       │
-- │ Queries Flutter auth: return_screens, admin returns     │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "returns_select"
  ON public.returns FOR SELECT
  USING (true);

CREATE POLICY "returns_insert_authenticated"
  ON public.returns FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "returns_update"
  ON public.returns FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │ COUPONS — Cupones de descuento                          │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (validación de cupón en checkout + admin) │
-- │ INSERT/UPDATE/DELETE: Abierto (admin Astro usa anon)    │
-- │                                                         │
-- │ Queries Astro anon: validateCoupon, admin/cupones CRUD  │
-- │ Queries Flutter auth: admin coupons CRUD                │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "coupons_select"
  ON public.coupons FOR SELECT
  USING (true);

CREATE POLICY "coupons_insert"
  ON public.coupons FOR INSERT
  WITH CHECK (true);

CREATE POLICY "coupons_update"
  ON public.coupons FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "coupons_delete"
  ON public.coupons FOR DELETE
  USING (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │ WISHLIST — Lista de deseos  ✅ RLS ESTRICTO             │
-- ├─────────────────────────────────────────────────────────┤
-- │ Cada usuario solo puede ver/modificar SUS favoritos.    │
-- │ Todas las queries filtran por user_id = auth.uid().     │
-- │                                                         │
-- │ SELECT: Solo propio (auth.uid() = user_id)              │
-- │ INSERT: Solo propio (no puedes añadir a otro usuario)   │
-- │ UPDATE: Solo propio                                     │
-- │ DELETE: Solo propio                                     │
-- │                                                         │
-- │ Queries Astro auth (client-side):                       │
-- │   favoritos.astro, api/wishlist.ts                      │
-- │ Queries Flutter auth:                                   │
-- │   wishlist_service.dart (todas filtran por userId)      │
-- │                                                         │
-- │ ⚠ Las funciones RPC (get_wishlist_low_stock_notif...)   │
-- │   son SECURITY DEFINER y bypassan RLS.                  │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "wishlist_select_own"
  ON public.wishlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "wishlist_insert_own"
  ON public.wishlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wishlist_update_own"
  ON public.wishlist FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wishlist_delete_own"
  ON public.wishlist FOR DELETE
  USING (auth.uid() = user_id);

-- ┌─────────────────────────────────────────────────────────┐
-- │ USER_SHIPPING_ADDRESSES — Direcciones  ✅ RLS ESTRICTO  │
-- ├─────────────────────────────────────────────────────────┤
-- │ Cada usuario solo puede gestionar SUS direcciones.      │
-- │                                                         │
-- │ SELECT: Solo propias (auth.uid() = user_id)             │
-- │ INSERT: Solo propias                                    │
-- │ UPDATE: Solo propias (incluye set/clear default)        │
-- │ DELETE: Solo propias                                    │
-- │                                                         │
-- │ Queries Astro auth (client-side):                       │
-- │   perfil.astro, CheckoutForm.tsx                        │
-- │ Queries Flutter auth:                                   │
-- │   addresses_provider.dart (todas con user.id)           │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "addresses_select_own"
  ON public.user_shipping_addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "addresses_insert_own"
  ON public.user_shipping_addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "addresses_update_own"
  ON public.user_shipping_addresses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "addresses_delete_own"
  ON public.user_shipping_addresses FOR DELETE
  USING (auth.uid() = user_id);

-- ┌─────────────────────────────────────────────────────────┐
-- │ NEWSLETTER_SUBSCRIBERS — Suscriptores  ✅ PARCIAL       │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (admin SSR necesita leer con anon)        │
-- │ INSERT: Solo autenticados ✅                            │
-- │   → service_role (newsletter-subscribe API) bypassa RLS │
-- │   → Upsert en perfil.astro es client-side con JWT      │
-- │ UPDATE: Solo autenticados ✅                            │
-- │   → Unsubscribe en perfil (client-side JWT)             │
-- │   → Flutter admin toggle (authenticated)                │
-- │ DELETE: Solo autenticados ✅                            │
-- │   → Flutter admin delete (authenticated)                │
-- │                                                         │
-- │ Queries Astro anon: admin/newsletter, send-newsletter,  │
-- │   admin/usuarios (solo SELECT)                          │
-- │ Queries Astro service: newsletter-subscribe,            │
-- │   admin/newsletter-subscribers                          │
-- │ Queries Astro auth: perfil.astro (subscribe/unsub)      │
-- │ Queries Flutter auth: admin newsletter management       │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "newsletter_select"
  ON public.newsletter_subscribers FOR SELECT
  USING (true);

CREATE POLICY "newsletter_insert_authenticated"
  ON public.newsletter_subscribers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "newsletter_update_authenticated"
  ON public.newsletter_subscribers FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "newsletter_delete_authenticated"
  ON public.newsletter_subscribers FOR DELETE
  USING (auth.role() = 'authenticated');

-- ┌─────────────────────────────────────────────────────────┐
-- │ ADMIN_USERS — Usuarios administradores  ✅ ESTRICTO     │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Abierto (isUserAdmin() en Astro usa anon,       │
-- │         Flutter admin check usa authenticated)          │
-- │ INSERT/UPDATE/DELETE: BLOQUEADO                         │
-- │   → Solo service_role puede modificar admin_users       │
-- │   → verifyAdminAccess, registerAdminUser, getAdminUsers │
-- │     todos usan getServiceSupabase()                     │
-- │                                                         │
-- │ Al no crear políticas INSERT/UPDATE/DELETE, estas        │
-- │ operaciones quedan bloqueadas para anon y authenticated. │
-- │ Solo service_role (que bypassa RLS) puede escribir.     │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "admin_users_select"
  ON public.admin_users FOR SELECT
  USING (true);

-- Sin políticas INSERT/UPDATE/DELETE = bloqueado para anon y authenticated
-- Solo service_role puede escribir (bypassa RLS)

-- ┌─────────────────────────────────────────────────────────┐
-- │ APP_SETTINGS — Configuración de la aplicación           │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (flash offers, thresholds, etc.)          │
-- │ INSERT/UPDATE: Abierto (admin SSR usa upsert con anon)  │
-- │                                                         │
-- │ Queries Astro anon: getSetting, admin/configuracion     │
-- │ Queries Flutter auth: settings_provider (read + upsert) │
-- │                                                         │
-- │ Nota: No hay DELETE en ningún cliente.                   │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "app_settings_select"
  ON public.app_settings FOR SELECT
  USING (true);

CREATE POLICY "app_settings_insert"
  ON public.app_settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "app_settings_update"
  ON public.app_settings FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │ SHIPPING_METHODS — Métodos de envío  ✅ SOLO LECTURA    │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (checkout muestra opciones de envío)      │
-- │ INSERT/UPDATE/DELETE: BLOQUEADO                         │
-- │   → No hay escritura desde Astro ni Flutter             │
-- │   → Para gestionar métodos, usar Supabase Dashboard     │
-- │     o service_role                                      │
-- │                                                         │
-- │ Queries Astro anon: getShippingMethods, admin/pedidos   │
-- │ Queries Flutter auth: checkout_provider                 │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "shipping_methods_select"
  ON public.shipping_methods FOR SELECT
  USING (true);

-- Sin políticas de escritura = solo service_role puede modificar

-- ┌─────────────────────────────────────────────────────────┐
-- │ SHIPPING_CARRIERS — Transportistas  ✅ SOLO LECTURA     │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (admin ve carriers, pedidos muestran      │
-- │         info de tracking)                               │
-- │ INSERT/UPDATE/DELETE: BLOQUEADO                         │
-- │                                                         │
-- │ Queries Astro anon: admin/pedidos                       │
-- │ Queries Flutter auth: orders/admin screens              │
-- └─────────────────────────────────────────────────────────┘

CREATE POLICY "shipping_carriers_select"
  ON public.shipping_carriers FOR SELECT
  USING (true);

-- Sin políticas de escritura = solo service_role puede modificar

-- ============================================================
-- PASO 6: TABLAS OPCIONALES
-- ============================================================
-- Estas tablas pueden no existir en todas las instalaciones.
-- Se crean las políticas condicionalmente.

-- ┌─────────────────────────────────────────────────────────┐
-- │ COUPON_USAGE — Uso de cupones (si existe)               │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (validación per-user en checkout + admin) │
-- │ INSERT: Abierto (se registra al usar un cupón)          │
-- │                                                         │
-- │ Queries Astro anon: validateCoupon (per-user check),    │
-- │   admin/cupones (usage counts)                          │
-- └─────────────────────────────────────────────────────────┘

DO $$ BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'coupon_usage'
  ) THEN
    EXECUTE 'CREATE POLICY "coupon_usage_select" ON public.coupon_usage FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "coupon_usage_insert" ON public.coupon_usage FOR INSERT WITH CHECK (true)';
  END IF;
END $$;

-- ┌─────────────────────────────────────────────────────────┐
-- │ PRODUCT_OFFERS — Ofertas de productos (si existe)       │
-- ├─────────────────────────────────────────────────────────┤
-- │ SELECT: Todos (se muestran ofertas en producto)         │
-- │ INSERT/UPDATE/DELETE: Abierto (gestión admin)           │
-- │                                                         │
-- │ Queries Astro anon: getProductOffer                     │
-- └─────────────────────────────────────────────────────────┘

DO $$ BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'product_offers'
  ) THEN
    EXECUTE 'CREATE POLICY "product_offers_select" ON public.product_offers FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "product_offers_insert" ON public.product_offers FOR INSERT WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "product_offers_update" ON public.product_offers FOR UPDATE USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "product_offers_delete" ON public.product_offers FOR DELETE USING (true)';
  END IF;
END $$;

-- ============================================================
-- PASO 7: VISTA wishlist_with_details
-- ============================================================
-- La vista wishlist_with_details se usa en Flutter para obtener
-- los favoritos del usuario con info del producto.
--
-- PROBLEMA: Por defecto, las vistas en PostgreSQL ejecutan como
-- el dueño de la vista, lo que BYPASSA el RLS de las tablas
-- subyacentes. Esto permitiría que un usuario vea los favoritos
-- de otros usuarios a través de la vista.
--
-- SOLUCIÓN: Activar security_invoker = true (PostgreSQL 15+)
-- para que la vista ejecute con los permisos del usuario que
-- hace la consulta, aplicando las políticas RLS de 'wishlist'.

DO $$ BEGIN
  IF EXISTS (
    SELECT FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'wishlist_with_details'
  ) THEN
    ALTER VIEW public.wishlist_with_details SET (security_invoker = true);
    EXECUTE 'GRANT SELECT ON public.wishlist_with_details TO authenticated';
  END IF;
END $$;

-- ============================================================
-- PASO 8: SEGURIDAD DE FUNCIONES RPC
-- ============================================================
-- Las funciones RPC que modifican datos deben ser SECURITY DEFINER
-- para bypassar RLS (ya que se llaman desde el cliente anon en
-- algunos casos). Verificamos y actualizamos si es necesario.
--
-- Funciones que deben ser SECURITY DEFINER:
-- • increment_stock(product_id_param, quantity_param)
-- • get_product_stock(product_id_param)
-- • decrement_size_stock(p_product_id, p_size, p_quantity)
-- • get_wishlist_low_stock_notifications(stock_threshold)
-- • get_wishlist_sale_notifications()
-- • mark_wishlist_notified(wishlist_ids)
-- • mark_wishlist_sale_notified(wishlist_ids)
-- • reset_wishlist_sale_notifications()
-- • generate_invoice_number()
-- • increment_product_size_stock(p_product_id, p_size, p_quantity)
--
-- Si alguna función no existe, el ALTER simplemente falla
-- silenciosamente dentro del bloque de excepción.

DO $$ BEGIN
  -- increment_stock
  ALTER FUNCTION public.increment_stock(integer, integer) SECURITY DEFINER;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.get_product_stock(integer) SECURITY DEFINER;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.decrement_size_stock(integer, text, integer) SECURITY DEFINER;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.get_wishlist_low_stock_notifications(integer) SECURITY DEFINER;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.get_wishlist_sale_notifications() SECURITY DEFINER;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.mark_wishlist_notified(integer[]) SECURITY DEFINER;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.mark_wishlist_sale_notified(integer[]) SECURITY DEFINER;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.reset_wishlist_sale_notifications() SECURITY DEFINER;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.generate_invoice_number() SECURITY DEFINER;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.increment_product_size_stock(integer, text, integer) SECURITY DEFINER;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Asegurar que las funciones RPC son ejecutables por los roles necesarios
DO $$ BEGIN
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMIT;

-- ============================================================
-- VERIFICACIÓN POST-EJECUCIÓN
-- ============================================================
-- Ejecutar estas queries para verificar que todo está correcto:
--
-- 1. Verificar que RLS está habilitado en todas las tablas:
--
--    SELECT tablename, rowsecurity 
--    FROM pg_tables 
--    WHERE schemaname = 'public' 
--    ORDER BY tablename;
--
-- 2. Listar todas las políticas creadas:
--
--    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
--    FROM pg_policies 
--    WHERE schemaname = 'public' 
--    ORDER BY tablename, policyname;
--
-- 3. Verificar la función is_admin():
--
--    SELECT public.is_admin();  -- Debería retornar false si no hay JWT
--
-- ============================================================
-- MATRIZ DE ACCESO RESULTANTE
-- ============================================================
--
-- ┌────────────────────────┬──────────┬──────────┬──────────────┐
-- │ Tabla                  │ anon     │ auth     │ service_role │
-- ├────────────────────────┼──────────┼──────────┼──────────────┤
-- │ products               │ CRUD     │ CRUD     │ BYPASS       │
-- │ categories             │ CRUD     │ CRUD     │ BYPASS       │
-- │ product_sizes          │ CRUD     │ CRUD     │ BYPASS       │
-- │ orders                 │ CRU      │ CRU      │ BYPASS       │
-- │ order_items            │ CR       │ CR       │ BYPASS       │
-- │ invoices               │ CRU      │ CRU      │ BYPASS       │
-- │ invoice_items          │ CR       │ CR       │ BYPASS       │
-- │ returns                │ R_U      │ CRUD     │ BYPASS       │
-- │ coupons                │ CRUD     │ CRUD     │ BYPASS       │
-- │ coupon_usage           │ CR       │ CR       │ BYPASS       │
-- │ product_offers         │ CRUD     │ CRUD     │ BYPASS       │
-- │ wishlist               │ ----     │ CRUD*    │ BYPASS       │
-- │ user_shipping_addrs    │ ----     │ CRUD*    │ BYPASS       │
-- │ newsletter_subscribers │ R        │ CRUD     │ BYPASS       │
-- │ admin_users            │ R        │ R        │ BYPASS       │
-- │ app_settings           │ CRU      │ CRU      │ BYPASS       │
-- │ shipping_methods       │ R        │ R        │ BYPASS       │
-- │ shipping_carriers      │ R        │ R        │ BYPASS       │
-- ├────────────────────────┼──────────┼──────────┼──────────────┤
-- │ * = Solo registros propios (user_id = auth.uid())          │
-- │ C=Create R=Read U=Update D=Delete                          │
-- │ ---- = Sin acceso                                          │
-- └────────────────────────┴──────────┴──────────┴──────────────┘
--
-- ============================================================
-- PLAN DE MEJORA (cuando se migre admin a service_role)
-- ============================================================
--
-- Cuando las páginas admin de Astro se migren a usar
-- getServiceSupabase(), se podrán restringir las escrituras:
--
-- -- Ejemplo para products:
-- DROP POLICY "products_insert" ON public.products;
-- DROP POLICY "products_update" ON public.products;
-- DROP POLICY "products_delete" ON public.products;
-- 
-- CREATE POLICY "products_insert_admin"
--   ON public.products FOR INSERT
--   WITH CHECK (public.is_admin());
-- 
-- CREATE POLICY "products_update_admin"
--   ON public.products FOR UPDATE
--   USING (public.is_admin())
--   WITH CHECK (public.is_admin());
-- 
-- CREATE POLICY "products_delete_admin"
--   ON public.products FOR DELETE
--   USING (public.is_admin());
--
-- Esto bloquearía escrituras anónimas y solo permitiría a
-- usuarios autenticados que estén en admin_users.
-- ============================================================
