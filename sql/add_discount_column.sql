-- ================================================
-- AÑADIR COLUMNA DISCOUNT A ORDERS
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- Añadir la columna discount a la tabla orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS discount INTEGER DEFAULT 0;

-- Comentario descriptivo
COMMENT ON COLUMN public.orders.discount IS 'Monto del descuento aplicado en céntimos';

-- Verificación
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'discount';
