-- Migración: Añadir límite de usos por usuario en cupones
-- Ejecutar en Supabase SQL Editor

-- 1. Añadir columna max_uses_per_user a la tabla coupons
ALTER TABLE public.coupons 
ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER NULL;

-- 2. Comentario descriptivo
COMMENT ON COLUMN public.coupons.max_uses_per_user IS 'Número máximo de veces que un mismo usuario puede usar este cupón. NULL = ilimitado.';

-- 3. Verificar la estructura actualizada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'coupons' 
ORDER BY ordinal_position;
