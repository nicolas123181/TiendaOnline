-- =====================================================
-- FIX: Agregar 'ready_for_pickup' al constraint check
-- Ejecutar en el SQL Editor de Supabase Dashboard
-- =====================================================

-- Eliminar el constraint existente
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Crear nuevo constraint con 'ready_for_pickup' incluido
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'paid', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled'));

-- Verificar que funciona
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'orders_status_check';
