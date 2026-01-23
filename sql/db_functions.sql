-- =====================================================
-- FUNCIONES FALTANTES PARA CANCELACIÓN Y DEVOLUCIONES
-- Ejecutar en el Editor SQL de Supabase
-- =====================================================

-- 1. Función para incrementar stock (CRÍTICA para cancelaciones)
CREATE OR REPLACE FUNCTION increment_stock(
  product_id_param INTEGER,
  quantity_param INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  -- Verificar si el producto existe y bloquear fila
  SELECT stock INTO current_stock
  FROM products
  WHERE id = product_id_param
  FOR UPDATE;

  IF current_stock IS NULL THEN
    RETURN FALSE; -- Producto no encontrado
  END IF;

  -- Actualizar stock
  UPDATE products
  SET stock = stock + quantity_param,
      updated_at = NOW()
  WHERE id = product_id_param;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 2. Función para obtener el stock actual (útil para validaciones)
CREATE OR REPLACE FUNCTION get_product_stock(product_id_param INT)
RETURNS INT AS $$
DECLARE
  stock_count INT;
BEGIN
  SELECT stock INTO stock_count FROM products WHERE id = product_id_param;
  RETURN stock_count;
END;
$$ LANGUAGE plpgsql;
