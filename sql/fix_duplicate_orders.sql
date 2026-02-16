-- ============================================================
-- FIX: Prevenir pedidos duplicados a nivel de base de datos
-- ============================================================
-- Añadir constraint UNIQUE en stripe_payment_intent_id para 
-- evitar race conditions cuando exito.astro se carga en paralelo.
-- 
-- Notas:
-- - Se usa UNIQUE parcial (WHERE stripe_payment_intent_id IS NOT NULL)
--   para permitir pedidos sin payment intent (legacy/test).
-- - Si ya hay duplicados, se deben eliminar primero.
-- ============================================================

-- Paso 1: Verificar y limpiar duplicados existentes (si los hay)
-- Este query muestra duplicados. Revisar manualmente antes de eliminar.
-- SELECT stripe_payment_intent_id, array_agg(id) as order_ids, count(*) 
-- FROM orders 
-- WHERE stripe_payment_intent_id IS NOT NULL 
-- GROUP BY stripe_payment_intent_id 
-- HAVING count(*) > 1;

-- Paso 2: Crear el índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id_unique
ON public.orders (stripe_payment_intent_id)
WHERE stripe_payment_intent_id IS NOT NULL;
