-- Agrega soporte para deshabilitar productos sin borrarlos
-- Útil para conservar referencias históricas en order_items

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Index opcional para acelerar consultas de catálogo público
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

-- Normaliza datos existentes con NULL (por seguridad)
UPDATE public.products
SET is_active = true
WHERE is_active IS NULL;
