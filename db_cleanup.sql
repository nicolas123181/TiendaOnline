-- ============================================
-- SCRIPT DE LIMPIEZA DE BASE DE DATOS
-- FashionShop / Vantage
-- Fecha: 2026-01-11
-- ============================================
-- Este script elimina tablas que no se usan en el código.
-- IMPORTANTE: Ejecuta esto SOLO después de hacer un backup de la BD.
-- ============================================

-- 1. Eliminar tablas que dependen de otras primero (por foreign keys)

-- coupon_usage depende de coupons y orders
DROP TABLE IF EXISTS public.coupon_usage CASCADE;

-- low_stock_alerts depende de products
DROP TABLE IF EXISTS public.low_stock_alerts CASCADE;

-- notifications depende de orders
DROP TABLE IF EXISTS public.notifications CASCADE;

-- product_offers depende de products
DROP TABLE IF EXISTS public.product_offers CASCADE;

-- product_variants depende de products
DROP TABLE IF EXISTS public.product_variants CASCADE;

-- 2. Eliminar tabla independiente
DROP TABLE IF EXISTS public.customers CASCADE;

-- ============================================
-- RESUMEN DE TABLAS ELIMINADAS:
-- ============================================
-- 1. customers        - Los datos del cliente se guardan directamente en orders
-- 2. coupon_usage     - No se rastrea el uso de cupones por pedido
-- 3. low_stock_alerts - No hay sistema de alertas implementado
-- 4. notifications    - No hay sistema de notificaciones implementado  
-- 5. product_offers   - Las ofertas se manejan con campos en products (is_on_sale, sale_price, sale_ends_at)
-- 6. product_variants - Las tallas se manejan en el frontend (hardcoded)
-- ============================================

-- Verificar que las tablas fueron eliminadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('customers', 'coupon_usage', 'low_stock_alerts', 'notifications', 'product_offers', 'product_variants');
-- Este query debería devolver 0 filas si todo se eliminó correctamente
