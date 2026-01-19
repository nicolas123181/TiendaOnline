-- =====================================================
-- SISTEMA DE DEVOLUCIONES - VANTAGE
-- =====================================================

-- 1. Crear tabla de devoluciones
CREATE TABLE IF NOT EXISTS returns (
  id SERIAL PRIMARY KEY,
  return_number VARCHAR(20) NOT NULL UNIQUE,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  reason_details TEXT,
  items JSONB NOT NULL, -- [{order_item_id, product_name, size, quantity, price}]
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'received', 'refunded', 'rejected')),
  refund_amount INTEGER, -- En céntimos
  tracking_number VARCHAR(100),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  received_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_email ON returns(customer_email);
CREATE INDEX IF NOT EXISTS idx_returns_number ON returns(return_number);

-- 3. Trigger para updated_at
DROP TRIGGER IF EXISTS update_returns_updated_at ON returns;
CREATE TRIGGER update_returns_updated_at
  BEFORE UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. RLS
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

-- Política de lectura para usuarios autenticados
CREATE POLICY "Returns viewable by authenticated" 
  ON returns FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Política de escritura para usuarios autenticados  
CREATE POLICY "Returns editable by authenticated"
  ON returns FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 5. Función para generar número de devolución
CREATE OR REPLACE FUNCTION generate_return_number()
RETURNS VARCHAR(20) AS $$
DECLARE
  next_num INTEGER;
  return_num VARCHAR(20);
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num
  FROM returns;
  
  return_num := 'RET-' || LPAD(next_num::TEXT, 5, '0');
  RETURN return_num;
END;
$$ LANGUAGE plpgsql;
