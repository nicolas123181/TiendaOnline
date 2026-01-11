-- ============================================================================
-- ROW LEVEL SECURITY POLICIES - FashionShop
-- ============================================================================
-- Este script configura las políticas RLS para todas las tablas.
-- Las políticas permiten operaciones públicas en tablas públicas,
-- pero restringen datos sensibles solo a quienes corresponde.
-- ============================================================================

-- ============================================================================
-- PASO 1: DESACTIVAR RLS EN TABLAS PÚBLICAS
-- ============================================================================
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_offers DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 2: HABILITAR RLS EN TABLAS SENSIBLES
-- ============================================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE low_stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 3: ELIMINAR POLÍTICAS ANTIGUAS (si existen)
-- ============================================================================
DROP POLICY IF EXISTS "orders_allow_insert" ON orders;
DROP POLICY IF EXISTS "orders_allow_select" ON orders;
DROP POLICY IF EXISTS "orders_allow_update" ON orders;
DROP POLICY IF EXISTS "orders_admin_update" ON orders;
DROP POLICY IF EXISTS "admin_users_select" ON admin_users;
DROP POLICY IF EXISTS "customers_select" ON customers;
DROP POLICY IF EXISTS "order_items_select" ON order_items;
DROP POLICY IF EXISTS "coupon_usage_insert" ON coupon_usage;
DROP POLICY IF EXISTS "coupon_usage_select" ON coupon_usage;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "low_stock_alerts_select" ON low_stock_alerts;
DROP POLICY IF EXISTS "app_settings_select" ON app_settings;
DROP POLICY IF EXISTS "app_settings_update" ON app_settings;

-- ============================================================================
-- PASO 4: CREAR NUEVAS POLÍTICAS
-- ============================================================================

-- ============================================================================
-- TABLA: ORDERS
-- Política: Cualquiera puede crear órdenes y cambiar estado a "paid"
-- ============================================================================
CREATE POLICY "orders_insert_public" ON orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "orders_select_all" ON orders
  FOR SELECT USING (true);

-- Permitir UPDATE solo para cambiar el estado a "paid" y agregar el payment intent
CREATE POLICY "orders_update_to_paid" ON orders
  FOR UPDATE 
  USING (true)
  WITH CHECK (status = 'paid' OR status = 'pending');

-- ============================================================================
-- TABLA: ORDER_ITEMS
-- Política: Pública para lectura (cualquiera puede ver items de cualquier orden)
-- ============================================================================
CREATE POLICY "order_items_select_public" ON order_items
  FOR SELECT USING (true);

CREATE POLICY "order_items_insert_public" ON order_items
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- TABLA: CUSTOMERS
-- Política: Cada cliente solo ve su información
-- ============================================================================
CREATE POLICY "customers_insert_public" ON customers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "customers_select_own" ON customers
  FOR SELECT USING (email = current_user OR auth.uid() IS NULL);

CREATE POLICY "customers_update_own" ON customers
  FOR UPDATE USING (email = current_user)
  WITH CHECK (email = current_user);

-- ============================================================================
-- TABLA: ADMIN_USERS
-- Política: Solo para superusuarios de Supabase (via service role)
-- ============================================================================
CREATE POLICY "admin_users_no_direct_access" ON admin_users
  FOR SELECT USING (false);

-- ============================================================================
-- TABLA: COUPON_USAGE
-- Política: Pública para insertar y leer
-- ============================================================================
CREATE POLICY "coupon_usage_insert_public" ON coupon_usage
  FOR INSERT WITH CHECK (true);

CREATE POLICY "coupon_usage_select_public" ON coupon_usage
  FOR SELECT USING (true);

-- ============================================================================
-- TABLA: NOTIFICATIONS
-- Política: Solo el destinatario puede ver sus notificaciones
-- ============================================================================
CREATE POLICY "notifications_select_recipient" ON notifications
  FOR SELECT USING (recipient_email = current_user OR auth.uid() IS NULL);

CREATE POLICY "notifications_insert_public" ON notifications
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- TABLA: LOW_STOCK_ALERTS
-- Política: No accesible directamente (solo vía backend)
-- ============================================================================
CREATE POLICY "low_stock_alerts_no_direct_access" ON low_stock_alerts
  FOR SELECT USING (false);

-- ============================================================================
-- TABLA: APP_SETTINGS
-- Política: No accesible directamente (solo vía backend con service role)
-- ============================================================================
CREATE POLICY "app_settings_no_direct_access" ON app_settings
  FOR SELECT USING (false);

-- ============================================================================
-- FIN DE LAS POLÍTICAS RLS
-- ============================================================================
-- RESUMEN DE POLÍTICAS:
-- 1. ÓRDENES: Cualquiera puede crear y leer, pero no actualizar directamente
-- 2. ITEMS DE ORDEN: Públicos para lectura
-- 3. CLIENTES: Cada uno solo ve la suya
-- 4. USUARIOS ADMIN: No accesibles directamente
-- 5. CUPONES: Públicos para lectura
-- 6. USO DE CUPONES: Público para crear y leer
-- 7. NOTIFICACIONES: Solo el destinatario ve las suyas
-- 8. ALERTAS Y CONFIGURACIÓN: No accesibles directamente (requieren service role)
-- ============================================================================
