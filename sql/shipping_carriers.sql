-- =====================================================
-- SISTEMA DE DISTRIBUIDORES - VANTAGE
-- =====================================================
-- Este script crea la tabla de transportistas y modifica
-- la tabla orders para soportar seguimiento de envíos

-- 1. Crear tabla de transportistas
CREATE TABLE IF NOT EXISTS shipping_carriers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  tracking_url_template VARCHAR(255),
  logo_url VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insertar distribuidores comunes en España
INSERT INTO shipping_carriers (name, code, tracking_url_template, display_order) VALUES
  ('SEUR', 'seur', 'https://www.seur.com/livetracking/?segOnlineIdentificador={tracking}', 1),
  ('MRW', 'mrw', 'https://www.mrw.es/seguimiento_envios/MRW_seguimiento_envios.asp?ref={tracking}', 2),
  ('Correos Express', 'correos_express', 'https://s.correosexpress.com/SeguimientoSin498/search?shippingNumber={tracking}', 3),
  ('GLS', 'gls', 'https://www.gls-spain.es/es/buscar-envio/?match={tracking}', 4),
  ('UPS', 'ups', 'https://www.ups.com/track?tracknum={tracking}', 5),
  ('DHL Express', 'dhl', 'https://www.dhl.com/es-es/home/rastreo.html?tracking-id={tracking}', 6),
  ('Nacex', 'nacex', 'https://www.nacex.es/seguimiento/{tracking}', 7),
  ('CTT Express', 'ctt', 'https://www.cttexpress.com/seguimiento?tracking={tracking}', 8),
  ('FedEx', 'fedex', 'https://www.fedex.com/fedextrack/?trknbr={tracking}', 9),
  ('Envialia', 'envialia', 'https://www.envialia.com/es/seguimiento/?envio={tracking}', 10)
ON CONFLICT (code) DO NOTHING;

-- 3. Añadir columnas a orders para tracking
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS carrier_id INTEGER REFERENCES shipping_carriers(id),
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100);

-- 4. Crear índice para búsquedas de tracking
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_number) WHERE tracking_number IS NOT NULL;

-- 5. Habilitar RLS para shipping_carriers
ALTER TABLE shipping_carriers ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública
CREATE POLICY IF NOT EXISTS "Allow public read shipping_carriers" 
  ON shipping_carriers FOR SELECT 
  USING (true);

-- Política de escritura para admins (a través de service role)
CREATE POLICY IF NOT EXISTS "Allow admin write shipping_carriers" 
  ON shipping_carriers FOR ALL 
  USING (true)
  WITH CHECK (true);
