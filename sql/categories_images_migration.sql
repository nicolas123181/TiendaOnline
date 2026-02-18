-- Escalable para imágenes de categorías en Cloudinary
-- 1) Guardamos URL para render rápido
-- 2) Guardamos public_id para poder borrar/reemplazar en Cloudinary sin fugas
-- 3) Metadata básica para trazabilidad

ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS image_public_id text,
ADD COLUMN IF NOT EXISTS image_provider character varying DEFAULT 'cloudinary',
ADD COLUMN IF NOT EXISTS image_updated_at timestamp with time zone DEFAULT now();

-- Índices opcionales para consultas/ordenaciones futuras
CREATE INDEX IF NOT EXISTS idx_categories_image_provider
ON public.categories (image_provider);

CREATE INDEX IF NOT EXISTS idx_categories_image_updated_at
ON public.categories (image_updated_at DESC);
