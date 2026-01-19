-- =====================================================
-- MIGRACIÓN: Sistema de Stock por Tallas
-- Ejecutar en el SQL Editor de Supabase Dashboard
-- =====================================================

-- Crear tabla de stock por tallas
CREATE TABLE IF NOT EXISTS product_sizes (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size VARCHAR(20) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Cada producto solo puede tener una entrada por talla
    UNIQUE(product_id, size)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_product_sizes_product ON product_sizes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_sizes_size ON product_sizes(size);
CREATE INDEX IF NOT EXISTS idx_product_sizes_stock ON product_sizes(stock) WHERE stock > 0;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_product_sizes_updated_at ON product_sizes;
CREATE TRIGGER update_product_sizes_updated_at
    BEFORE UPDATE ON product_sizes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Product sizes are viewable by everyone"
    ON product_sizes FOR SELECT
    USING (true);

CREATE POLICY "Product sizes are editable by authenticated users"
    ON product_sizes FOR ALL
    USING (auth.role() = 'authenticated');

-- =====================================================
-- FUNCIÓN: Decrementar stock por talla atómicamente
-- =====================================================
CREATE OR REPLACE FUNCTION decrement_size_stock(
    p_product_id INTEGER,
    p_size VARCHAR(20),
    p_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    current_stock INTEGER;
BEGIN
    -- Bloquear la fila para evitar race conditions
    SELECT stock INTO current_stock
    FROM product_sizes
    WHERE product_id = p_product_id AND size = p_size
    FOR UPDATE;
    
    -- Verificar si existe la talla
    IF current_stock IS NULL THEN
        RAISE EXCEPTION 'Talla no encontrada para este producto';
    END IF;
    
    -- Verificar si hay suficiente stock
    IF current_stock < p_quantity THEN
        RETURN FALSE; -- No hay suficiente stock
    END IF;
    
    -- Decrementar stock
    UPDATE product_sizes
    SET stock = stock - p_quantity,
        updated_at = NOW()
    WHERE product_id = p_product_id AND size = p_size;
    
    -- También actualizar el stock total del producto
    UPDATE products
    SET stock = (
        SELECT COALESCE(SUM(stock), 0) 
        FROM product_sizes 
        WHERE product_id = p_product_id
    ),
    updated_at = NOW()
    WHERE id = p_product_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN: Obtener stock total por producto
-- =====================================================
CREATE OR REPLACE FUNCTION get_total_stock(p_product_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(stock), 0)
        FROM product_sizes
        WHERE product_id = p_product_id
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN: Sincronizar stock total del producto
-- Se ejecuta automáticamente cuando cambia product_sizes
-- =====================================================
CREATE OR REPLACE FUNCTION sync_product_total_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar stock total en products
    UPDATE products
    SET stock = (
        SELECT COALESCE(SUM(stock), 0)
        FROM product_sizes
        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar stock total
DROP TRIGGER IF EXISTS sync_stock_on_size_change ON product_sizes;
CREATE TRIGGER sync_stock_on_size_change
    AFTER INSERT OR UPDATE OR DELETE ON product_sizes
    FOR EACH ROW
    EXECUTE FUNCTION sync_product_total_stock();

-- =====================================================
-- MIGRACIÓN DE DATOS EXISTENTES
-- Distribuir stock actual uniformemente entre tallas
-- =====================================================
DO $$
DECLARE
    prod RECORD;
    cat_slug VARCHAR;
    sizes TEXT[];
    size_item TEXT;
    stock_per_size INTEGER;
    remainder INTEGER;
    i INTEGER;
BEGIN
    -- Recorrer todos los productos con stock > 0
    FOR prod IN 
        SELECT p.id, p.stock, p.category_id, c.slug as cat_slug
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.stock > 0
    LOOP
        -- Determinar tallas según categoría
        CASE prod.cat_slug
            WHEN 'camisas' THEN sizes := ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL'];
            WHEN 'camisetas' THEN sizes := ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL'];
            WHEN 'pantalones' THEN sizes := ARRAY['38', '40', '42', '44', '46', '48', '50'];
            WHEN 'trajes' THEN sizes := ARRAY['46', '48', '50', '52', '54', '56'];
            WHEN 'chalecos' THEN sizes := ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL'];
            WHEN 'abrigos' THEN sizes := ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL'];
            ELSE sizes := ARRAY['S', 'M', 'L', 'XL'];
        END CASE;
        
        -- Calcular stock por talla
        stock_per_size := prod.stock / array_length(sizes, 1);
        remainder := prod.stock % array_length(sizes, 1);
        i := 0;
        
        -- Insertar stock por cada talla
        FOREACH size_item IN ARRAY sizes
        LOOP
            i := i + 1;
            INSERT INTO product_sizes (product_id, size, stock)
            VALUES (
                prod.id, 
                size_item, 
                stock_per_size + (CASE WHEN i <= remainder THEN 1 ELSE 0 END)
            )
            ON CONFLICT (product_id, size) DO UPDATE SET stock = EXCLUDED.stock;
        END LOOP;
    END LOOP;
END;
$$;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
