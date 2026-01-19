-- =====================================================
-- WISHLIST / LISTA DE DESEOS
-- Permite a usuarios guardar productos con talla específica
-- y recibir alertas cuando quedan pocas unidades o entran en oferta
-- =====================================================

-- Crear tabla de wishlist
CREATE TABLE IF NOT EXISTS public.wishlist (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    size VARCHAR(20) NOT NULL,
    notified_low_stock BOOLEAN DEFAULT FALSE,  -- Para evitar enviar múltiples emails
    notified_sale BOOLEAN DEFAULT FALSE,       -- Para notificación de ofertas
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Un usuario solo puede tener un producto+talla en su wishlist una vez
    UNIQUE(user_id, product_id, size)
);

-- Si la tabla ya existe, añadir la columna notified_sale
ALTER TABLE public.wishlist ADD COLUMN IF NOT EXISTS notified_sale BOOLEAN DEFAULT FALSE;

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON public.wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product_id ON public.wishlist(product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product_size ON public.wishlist(product_id, size);

-- RLS (Row Level Security)
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver sus propios items de wishlist
DROP POLICY IF EXISTS "Users can view own wishlist" ON public.wishlist;
CREATE POLICY "Users can view own wishlist" 
    ON public.wishlist FOR SELECT 
    USING (auth.uid() = user_id);

-- Política: Los usuarios pueden insertar en su propia wishlist
DROP POLICY IF EXISTS "Users can insert own wishlist items" ON public.wishlist;
CREATE POLICY "Users can insert own wishlist items" 
    ON public.wishlist FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden eliminar de su propia wishlist
DROP POLICY IF EXISTS "Users can delete own wishlist items" ON public.wishlist;
CREATE POLICY "Users can delete own wishlist items" 
    ON public.wishlist FOR DELETE 
    USING (auth.uid() = user_id);

-- Política: Los usuarios pueden actualizar su propia wishlist
DROP POLICY IF EXISTS "Users can update own wishlist" ON public.wishlist;
CREATE POLICY "Users can update own wishlist" 
    ON public.wishlist FOR UPDATE 
    USING (auth.uid() = user_id);

-- =====================================================
-- VISTA PARA WISHLIST CON DETALLES DE PRODUCTO Y STOCK
-- =====================================================

CREATE OR REPLACE VIEW public.wishlist_with_details AS
SELECT 
    w.id,
    w.user_id,
    w.product_id,
    w.size,
    w.notified_low_stock,
    w.notified_sale,
    w.created_at,
    p.name AS product_name,
    p.slug AS product_slug,
    p.price AS product_price,
    p.sale_price AS product_sale_price,
    p.is_on_sale AS product_is_on_sale,
    p.images AS product_images,
    p.stock AS product_total_stock,
    COALESCE(ps.stock, 0) AS size_stock,
    u.email AS user_email,
    u.raw_user_meta_data->>'name' AS user_name
FROM public.wishlist w
JOIN public.products p ON w.product_id = p.id
LEFT JOIN public.product_sizes ps ON ps.product_id = w.product_id AND ps.size = w.size
LEFT JOIN auth.users u ON w.user_id = u.id;

-- =====================================================
-- FUNCIÓN PARA OBTENER USUARIOS A NOTIFICAR (STOCK BAJO)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_wishlist_low_stock_notifications(
    stock_threshold INTEGER DEFAULT 9
)
RETURNS TABLE (
    wishlist_id INTEGER,
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    product_id INTEGER,
    product_name VARCHAR,
    product_slug VARCHAR,
    product_price INTEGER,
    product_image TEXT,
    size VARCHAR,
    size_stock INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id AS wishlist_id,
        w.user_id,
        u.email::TEXT AS user_email,
        (u.raw_user_meta_data->>'name')::TEXT AS user_name,
        w.product_id,
        p.name AS product_name,
        p.slug AS product_slug,
        p.price AS product_price,
        p.images[1]::TEXT AS product_image,
        w.size,
        COALESCE(ps.stock, 0)::INTEGER AS size_stock
    FROM public.wishlist w
    JOIN public.products p ON w.product_id = p.id
    LEFT JOIN public.product_sizes ps ON ps.product_id = w.product_id AND ps.size = w.size
    JOIN auth.users u ON w.user_id = u.id
    WHERE COALESCE(ps.stock, 0) > 0  -- Aún hay stock
      AND COALESCE(ps.stock, 0) <= stock_threshold  -- Pero está bajo
      AND w.notified_low_stock = FALSE  -- No notificado aún
    ORDER BY COALESCE(ps.stock, 0) ASC;  -- Primero los más urgentes
END;
$$;

-- =====================================================
-- FUNCIÓN PARA OBTENER USUARIOS A NOTIFICAR (OFERTAS)
-- Devuelve items de wishlist donde el producto está en oferta
-- y aún no se ha notificado de esta oferta
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_wishlist_sale_notifications()
RETURNS TABLE (
    wishlist_id INTEGER,
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    product_id INTEGER,
    product_name VARCHAR,
    product_slug VARCHAR,
    original_price INTEGER,
    sale_price INTEGER,
    discount_percentage INTEGER,
    product_image TEXT,
    size VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id AS wishlist_id,
        w.user_id,
        u.email::TEXT AS user_email,
        (u.raw_user_meta_data->>'name')::TEXT AS user_name,
        w.product_id,
        p.name AS product_name,
        p.slug AS product_slug,
        p.price AS original_price,
        p.sale_price,
        ((p.price - p.sale_price) * 100 / p.price)::INTEGER AS discount_percentage,
        p.images[1]::TEXT AS product_image,
        w.size
    FROM public.wishlist w
    JOIN public.products p ON w.product_id = p.id
    JOIN auth.users u ON w.user_id = u.id
    WHERE p.is_on_sale = TRUE
      AND p.sale_price IS NOT NULL
      AND p.sale_price < p.price
      AND w.notified_sale = FALSE  -- No notificado aún de esta oferta
    ORDER BY ((p.price - p.sale_price) * 100 / p.price) DESC;  -- Mayor descuento primero
END;
$$;

-- =====================================================
-- FUNCIÓN PARA MARCAR COMO NOTIFICADO (STOCK BAJO)
-- =====================================================

CREATE OR REPLACE FUNCTION public.mark_wishlist_notified(wishlist_ids INTEGER[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.wishlist
    SET notified_low_stock = TRUE
    WHERE id = ANY(wishlist_ids);
END;
$$;

-- =====================================================
-- FUNCIÓN PARA MARCAR COMO NOTIFICADO (OFERTA)
-- =====================================================

CREATE OR REPLACE FUNCTION public.mark_wishlist_sale_notified(wishlist_ids INTEGER[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.wishlist
    SET notified_sale = TRUE
    WHERE id = ANY(wishlist_ids);
END;
$$;

-- =====================================================
-- FUNCIÓN PARA RESETEAR notified_sale CUANDO TERMINA OFERTA
-- Esto permite re-notificar si el mismo producto vuelve a entrar en oferta
-- =====================================================

CREATE OR REPLACE FUNCTION public.reset_wishlist_sale_notifications()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Resetear notified_sale para productos que ya no están en oferta
    UPDATE public.wishlist w
    SET notified_sale = FALSE
    FROM public.products p
    WHERE w.product_id = p.id
      AND w.notified_sale = TRUE
      AND (p.is_on_sale = FALSE OR p.sale_price IS NULL);
END;
$$;

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE public.wishlist IS 'Lista de deseos de usuarios con productos y tallas específicas';
COMMENT ON COLUMN public.wishlist.notified_low_stock IS 'Indica si ya se envió notificación de stock bajo';
COMMENT ON COLUMN public.wishlist.notified_sale IS 'Indica si ya se envió notificación de oferta actual';
COMMENT ON FUNCTION public.get_wishlist_low_stock_notifications IS 'Obtiene items de wishlist que necesitan notificación de stock bajo';
COMMENT ON FUNCTION public.get_wishlist_sale_notifications IS 'Obtiene items de wishlist de productos en oferta no notificados';
COMMENT ON FUNCTION public.mark_wishlist_notified IS 'Marca items de wishlist como ya notificados (stock bajo)';
COMMENT ON FUNCTION public.mark_wishlist_sale_notified IS 'Marca items de wishlist como ya notificados (oferta)';
COMMENT ON FUNCTION public.reset_wishlist_sale_notifications IS 'Resetea notificaciones de oferta cuando productos salen de oferta';

