-- ============================================================
-- RLS PARA TABLAS FALTANTES — VANTAGE FASHION
-- ============================================================
-- Tablas cubiertas en este script:
--   • coupon_usage
--   • customers
--   • low_stock_alerts
--   • notifications
--   • product_offers
--   • product_variants
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  CONTEXTO DE ARQUITECTURA (crítico para entender el diseño) │
-- ├─────────────────────────────────────────────────────────────┤
-- │                                                             │
-- │  ROL 'anon'          → cliente supabase SIN JWT             │
-- │                         Usado por: páginas admin Astro SSR, │
-- │                         validación de cupones en checkout,  │
-- │                         listado público de ofertas          │
-- │                                                             │
-- │  ROL 'authenticated' → cliente supabase CON JWT de usuario  │
-- │                         Usado por: browser del cliente      │
-- │                         logueado (wishlist, perfil, etc.)   │
-- │                                                             │
-- │  service_role        → cliente getServiceSupabase()         │
-- │                         BYPASA completamente el RLS.        │
-- │                         Usado por: confirm-payment.ts,      │
-- │                         facturas, devoluciones con refund   │
-- │                                                             │
-- │  ⚠️  Las páginas /admin/* de Astro usan el cliente anon     │
-- │     (no service_role). Por eso algunos permisos de escritura│
-- │     deben quedar abiertos para anon en tablas de catálogo.  │
-- │                                                             │
-- └─────────────────────────────────────────────────────────────┘
--
-- CÓMO EJECUTAR:
--   Supabase Dashboard → SQL Editor → pegar y ejecutar.
-- ============================================================

BEGIN;

-- ============================================================
-- PASO 1: LIMPIAR POLÍTICAS ANTIGUAS DE ESTAS TABLAS
-- ============================================================
-- Elimina cualquier política previa (incluyendo las del
-- rls-policies.sql original que tenía errores o era incompleto)

DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOR tbl IN VALUES
    ('coupon_usage'),
    ('customers'),
    ('low_stock_alerts'),
    ('notifications'),
    ('product_offers'),
    ('product_variants')
  LOOP
    FOR pol IN (
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
    ) LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        pol.policyname, tbl
      );
    END LOOP;
  END LOOP;
END
$$;

-- ============================================================
-- PASO 2: HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================
-- product_offers y product_variants estaban con RLS DISABLE
-- en el rls-policies.sql original. Aquí los habilitamos con
-- políticas seguras.

ALTER TABLE IF EXISTS public.coupon_usage       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.low_stock_alerts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_offers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_variants   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASO 3: PERMISOS DE TABLA (GRANT)
-- ============================================================
-- Necesario para que el cliente anon/authenticated pueda
-- siquiera intentar acceder (el RLS luego filtra qué filas).

-- coupon_usage: anon necesita SELECT (validación de cupones en
--   checkout y panel admin de cupones). INSERT se mantiene por
--   si algún flujo futuro lo requiere desde el cliente.
GRANT SELECT, INSERT ON public.coupon_usage
  TO anon, authenticated;

-- customers: Solo lectura para authenticated (ver su propio
--   registro en el perfil). Los INSERTs y UPDATEs los hace
--   service_role (confirm-payment.ts).
GRANT SELECT ON public.customers
  TO authenticated;

-- low_stock_alerts: Solo accesible via service_role.
--   No concedemos nada a anon/authenticated.
--   (Si existe la tabla)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'low_stock_alerts') THEN
    REVOKE ALL ON public.low_stock_alerts FROM anon, authenticated;
  END IF;
END $$;

-- notifications: Solo lectura para authenticated (sus propias).
--   Los INSERTs los hace service_role o funciones de Supabase.
GRANT SELECT ON public.notifications
  TO authenticated;

-- product_offers: Lectura pública (los precios de oferta se
--   muestran en las páginas de producto sin autenticación).
--   Escritura solo para anon porque el admin Astro usa anon key.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_offers
  TO anon, authenticated;

-- product_variants: Lectura pública (posibles variantes de
--   producto visibles en catálogo). Escritura abierta para anon
--   porque el admin Astro usa anon key.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants
  TO anon, authenticated;


-- ============================================================
-- ── COUPON_USAGE ─────────────────────────────────────────────
-- ============================================================
--
-- Uso en la web:
--   • SELECT (anon)  → supabase.ts:validateCoupon() cuenta usos
--                      por email del usuario para límite per-user
--   • SELECT (anon)  → admin/cupones.astro muestra estadísticas
--   • INSERT         → confirm-payment.ts usa service_role
--                      (bypasa RLS), pero se permite anon como
--                      fallback de seguridad
--   • UPDATE/DELETE  → solo service_role (nadie debe modificar
--                      el historial de uso directamente)
--
-- Matriz resultante:
--   anon          → SELECT ✓  INSERT ✓  UPDATE ✗  DELETE ✗
--   authenticated → SELECT ✓  INSERT ✓  UPDATE ✗  DELETE ✗
--   service_role  → BYPASS (todo)

-- Lectura pública: necesaria para la validación de cupones desde
-- el formulario de checkout (cliente anon sin JWT).
CREATE POLICY "coupon_usage_select_public"
  ON public.coupon_usage
  FOR SELECT
  USING (true);

-- Inserción pública: el flujo de confirmación de pago
-- (confirm-payment.ts) usa service_role pero se permite anon
-- como capa de compatibilidad hacia atrás.
CREATE POLICY "coupon_usage_insert_public"
  ON public.coupon_usage
  FOR INSERT
  WITH CHECK (true);

-- Bloqueo explícito de UPDATE: nadie (excepto service_role)
-- debe poder modificar registros históricos de uso de cupones.
CREATE POLICY "coupon_usage_no_update"
  ON public.coupon_usage
  FOR UPDATE
  USING (false);

-- Bloqueo explícito de DELETE: protege la trazabilidad.
-- Si se necesita borrar, hacerlo desde el backend con service_role.
CREATE POLICY "coupon_usage_no_delete"
  ON public.coupon_usage
  FOR DELETE
  USING (false);


-- ============================================================
-- ── CUSTOMERS ────────────────────────────────────────────────
-- ============================================================
--
-- Uso en la web:
--   • No se encuentra ninguna consulta directa a esta tabla
--     en las páginas SSR ni en los API routes del frontend.
--   • Los datos se gestionan vía service_role (que bypasa RLS)
--     desde confirm-payment.ts o triggers de base de datos.
--   • Se reserva SELECT para usuarios autenticados que quieran
--     ver su propia ficha de cliente (historial de gasto, etc.)
--     en futuras mejoras del perfil.
--
-- Matriz resultante:
--   anon          → SELECT ✗  INSERT ✗  UPDATE ✗  DELETE ✗
--   authenticated → SELECT ✓* INSERT ✗  UPDATE ✗  DELETE ✗
--   service_role  → BYPASS (todo)
--   (* solo su propio registro: auth.email() = email)

-- Un usuario autenticado solo puede ver su propio registro.
-- Usa auth.email() para comparar con el campo email de la tabla.
-- Nota: auth.email() devuelve el email del JWT, a diferencia de
-- current_user que devuelve el rol de PostgreSQL (era el bug
-- del rls-policies.sql original).
CREATE POLICY "customers_select_own"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (email = auth.email());

-- Bloqueos explícitos para anon y authenticated.
-- Todas las escrituras se realizan via service_role desde el
-- backend (confirm-payment.ts → upsert de estadísticas del
-- cliente, etc.). No hace falta exponer INSERT/UPDATE al cliente.
CREATE POLICY "customers_no_insert_direct"
  ON public.customers
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "customers_no_update_direct"
  ON public.customers
  FOR UPDATE
  USING (false);

CREATE POLICY "customers_no_delete_direct"
  ON public.customers
  FOR DELETE
  USING (false);


-- ============================================================
-- ── LOW_STOCK_ALERTS ──────────────────────────────────────────
-- ============================================================
--
-- Uso en la web:
--   • No hay ninguna consulta directa a esta tabla desde código
--     TypeScript/Astro. La constante LOW_STOCK_THRESHOLD es una
--     variable JavaScript en email.ts, no una lectura de tabla.
--   • Los registros podrían insertarse vía service_role en
--     confirm-payment.ts o via triggers de DB.
--   • La tabla es puramente operacional/interna del backend.
--
-- Matriz resultante:
--   anon          → todo ✗ (ningún acceso directo)
--   authenticated → todo ✗ (ningún acceso directo)
--   service_role  → BYPASS (todo)

-- Sin políticas para anon/authenticated + RLS habilitado =
-- denegación total por defecto en PostgreSQL/Supabase.
--
-- Añadimos políticas explícitas de bloqueo por claridad y para
-- evitar que cualquier bug futuro filtre alertas de inventario.

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'low_stock_alerts') THEN

    EXECUTE '
      CREATE POLICY "low_stock_alerts_no_anon_access"
        ON public.low_stock_alerts
        FOR ALL
        USING (false)
        WITH CHECK (false)
    ';

  END IF;
END $$;


-- ============================================================
-- ── NOTIFICATIONS ─────────────────────────────────────────────
-- ============================================================
--
-- Uso en la web:
--   • No hay consultas directas a esta tabla desde TypeScript.
--     Las "notificaciones" que aparecen en el código usan RPCs
--     (get_wishlist_low_stock_notifications, etc.) que tienen
--     su propia seguridad.
--   • Los INSERTs en esta tabla se hacen via service_role o
--     funciones de Supabase (SECURITY DEFINER).
--
-- Matriz resultante:
--   anon          → todo ✗ (ningún acceso directo)
--   authenticated → SELECT ✓* UPDATE ✗  INSERT ✗  DELETE ✗
--   service_role  → BYPASS (todo)
--   (* solo las suyas: recipient_email = auth.email())
--
-- Bug del rls-policies.sql original:
--   Usaba "recipient_email = current_user" → INCORRECTO.
--   current_user en PostgreSQL devuelve el nombre del rol de
--   conexión ('anon', 'authenticated'), NO el email del usuario.
--   La forma correcta es auth.email() que lee el claim 'email'
--   del JWT de Supabase.

-- Un usuario autenticado puede leer solo sus propias notificaciones.
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (recipient_email = auth.email());

-- Bloqueo de escritura directa para anon y authenticated.
-- Toda creación y actualización de notificaciones ocurre en el
-- backend con service_role.
CREATE POLICY "notifications_no_insert_direct"
  ON public.notifications
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "notifications_no_update_direct"
  ON public.notifications
  FOR UPDATE
  USING (false);

CREATE POLICY "notifications_no_delete_direct"
  ON public.notifications
  FOR DELETE
  USING (false);


-- ============================================================
-- ── PRODUCT_OFFERS ────────────────────────────────────────────
-- ============================================================
--
-- Uso en la web:
--   • SELECT (anon) → supabase.ts:getProductOffer() muestra el
--     precio de oferta activo en las páginas de producto.
--     Código: supabase.from('product_offers').select('*')
--             .eq('product_id', id).eq('is_active', true)...
--   • INSERT/UPDATE/DELETE (anon) → páginas /admin/* de Astro
--     gestionan las ofertas usando el cliente anon (supabase).
--     Hasta que admin migre a usar getServiceSupabase(), estas
--     operaciones deben estar abiertas para anon.
--
-- Nota de seguridad:
--   El acceso abierto de escritura para anon es una limitación
--   conocida por la arquitectura actual. Ver PLAN DE MEJORA en
--   rls_policies_complete.sql para la solución a largo plazo.
--
-- Matriz resultante:
--   anon          → CRUD ✓
--   authenticated → CRUD ✓
--   service_role  → BYPASS (todo)

CREATE POLICY "product_offers_select_public"
  ON public.product_offers
  FOR SELECT
  USING (true);

CREATE POLICY "product_offers_insert_open"
  ON public.product_offers
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "product_offers_update_open"
  ON public.product_offers
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "product_offers_delete_open"
  ON public.product_offers
  FOR DELETE
  USING (true);


-- ============================================================
-- ── PRODUCT_VARIANTS ──────────────────────────────────────────
-- ============================================================
--
-- Uso en la web:
--   • No se encontraron consultas directas a esta tabla en el
--     código TypeScript/Astro actual. La tabla existe en el
--     esquema pero no está siendo usada activamente.
--   • Si en el futuro el catálogo muestra variantes (color,
--     material, etc.), serán lecturas públicas.
--   • Las escrituras vendrían del panel admin (actualmente
--     usa cliente anon) o desde el backend con service_role.
--
-- Matriz resultante:
--   anon          → CRUD ✓  (preparado para admin Astro SSR)
--   authenticated → CRUD ✓
--   service_role  → BYPASS (todo)

CREATE POLICY "product_variants_select_public"
  ON public.product_variants
  FOR SELECT
  USING (true);

CREATE POLICY "product_variants_insert_open"
  ON public.product_variants
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "product_variants_update_open"
  ON public.product_variants
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "product_variants_delete_open"
  ON public.product_variants
  FOR DELETE
  USING (true);


-- ============================================================
-- PASO 4: VERIFICACIÓN (opcional, se puede comentar)
-- ============================================================
-- Ejecutar después del commit para confirmar que todo está bien.

-- SELECT tablename, policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'coupon_usage', 'customers', 'low_stock_alerts',
--     'notifications', 'product_offers', 'product_variants'
--   )
-- ORDER BY tablename, cmd;

COMMIT;

-- ============================================================
-- RESUMEN DE POLÍTICAS APLICADAS
-- ============================================================
--
-- ┌────────────────────┬──────────┬──────────────┬──────────────┐
-- │ Tabla              │ anon     │ authenticated│ service_role │
-- ├────────────────────┼──────────┼──────────────┼──────────────┤
-- │ coupon_usage       │ CR--     │ CR--         │ BYPASS       │
-- │                    │ SELECT ✓ │ SELECT ✓     │              │
-- │                    │ INSERT ✓ │ INSERT ✓     │              │
-- │                    │ UPDATE ✗ │ UPDATE ✗     │              │
-- │                    │ DELETE ✗ │ DELETE ✗     │              │
-- ├────────────────────┼──────────┼──────────────┼──────────────┤
-- │ customers          │ ----     │ R solo propia│ BYPASS       │
-- │                    │ todo ✗   │ SELECT ✓*    │              │
-- │                    │          │ resto ✗      │              │
-- │                    │ (* email = auth.email())              │
-- ├────────────────────┼──────────┼──────────────┼──────────────┤
-- │ low_stock_alerts   │ todo ✗   │ todo ✗       │ BYPASS       │
-- │                    │ (solo backend interno)                │
-- ├────────────────────┼──────────┼──────────────┼──────────────┤
-- │ notifications      │ todo ✗   │ R solo propia│ BYPASS       │
-- │                    │          │ SELECT ✓*    │              │
-- │                    │          │ resto ✗      │              │
-- │                    │ (* recipient_email = auth.email())    │
-- ├────────────────────┼──────────┼──────────────┼──────────────┤
-- │ product_offers     │ CRUD ✓   │ CRUD ✓       │ BYPASS       │
-- │                    │ (admin Astro usa anon key)            │
-- ├────────────────────┼──────────┼──────────────┼──────────────┤
-- │ product_variants   │ CRUD ✓   │ CRUD ✓       │ BYPASS       │
-- │                    │ (preparado para admin Astro)          │
-- └────────────────────┴──────────┴──────────────┴──────────────┘
--
-- NOTAS:
--   1. service_role SIEMPRE bypasa el RLS → todas las
--      operaciones del backend (confirm-payment.ts, facturas,
--      devoluciones) funcionan sin restricciones.
--
--   2. coupon_usage UPDATE/DELETE bloqueados intencionalmente
--      para proteger el historial de uso de cupones.
--
--   3. customers y notifications solo accesibles por el propio
--      usuario autenticado. Las escrituras las hace el backend
--      con service_role.
--
--   4. low_stock_alerts completamente privada. Solo el backend
--      la gestiona. No hay interfaz web que la consulte.
--
--   5. product_offers y product_variants mantienen acceso
--      amplio porque el panel admin de Astro usa el cliente
--      anon (limitación de arquitectura actual).
--
--   PLAN DE MEJORA FUTURO:
--   Cuando las páginas /admin/* de Astro migren a usar
--   getServiceSupabase() para escrituras, se podrá restringir
--   product_offers y product_variants a solo lectura para anon:
--
--     DROP POLICY "product_offers_insert_open" ON product_offers;
--     CREATE POLICY "product_offers_insert_admin"
--       ON product_offers FOR INSERT
--       WITH CHECK (public.is_admin());
--     -- (mismo patrón para UPDATE y DELETE)
-- ============================================================
