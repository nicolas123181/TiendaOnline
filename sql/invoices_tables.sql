-- ================================================
-- SISTEMA DE FACTURAS - VANTAGE
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- 1. Crear secuencia para número de factura
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1 INCREMENT 1;

-- 2. Tabla de facturas
CREATE TABLE IF NOT EXISTS public.invoices (
  id SERIAL PRIMARY KEY,
  -- Número de factura formateado (ej: VNT-2026-0001)
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  -- Referencia al pedido
  order_id INTEGER NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  -- Datos del cliente (snapshot en el momento de la factura)
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_address TEXT,
  customer_city VARCHAR(100),
  customer_postal_code VARCHAR(20),
  customer_phone VARCHAR(20),
  -- Datos de la empresa (configurables)
  company_name VARCHAR(255) DEFAULT 'Vantage Fashion S.L.',
  company_address TEXT DEFAULT 'Calle de la Moda 123, 28001 Madrid',
  company_nif VARCHAR(20) DEFAULT 'B-12345678',
  company_email VARCHAR(255) DEFAULT 'contacto@vantage.com',
  company_phone VARCHAR(20) DEFAULT '+34 900 123 456',
  -- Importes
  subtotal INTEGER NOT NULL, -- en céntimos
  shipping_cost INTEGER DEFAULT 0,
  discount INTEGER DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 21.00, -- IVA 21%
  tax_amount INTEGER NOT NULL, -- en céntimos
  total INTEGER NOT NULL, -- en céntimos
  -- Método de pago
  payment_method VARCHAR(100) DEFAULT 'Tarjeta de crédito',
  payment_status VARCHAR(50) DEFAULT 'paid',
  -- Fechas
  issue_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  due_date TIMESTAMP WITH TIME ZONE,
  -- Estado
  status VARCHAR(50) DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'sent', 'paid', 'cancelled')),
  -- PDF guardado
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  -- Notas
  notes TEXT,
  -- Metadatos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_email ON public.invoices(customer_email);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON public.invoices(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- 4. Tabla de líneas de factura (items)
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES public.products(id) ON DELETE SET NULL,
  -- Datos del producto (snapshot)
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  product_size VARCHAR(50),
  -- Cantidades y precios
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL, -- precio unitario en céntimos
  discount_percent DECIMAL(5,2) DEFAULT 0,
  line_total INTEGER NOT NULL, -- total de línea en céntimos
  -- Metadatos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- 5. Función para generar número de factura automático
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_part TEXT;
BEGIN
  year_part := to_char(CURRENT_DATE, 'YYYY');
  seq_part := lpad(nextval('invoice_number_seq')::TEXT, 5, '0');
  RETURN 'VNT-' || year_part || '-' || seq_part;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoice_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_updated_at();

-- 7. RLS (Row Level Security)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Política: lectura pública para admins autenticados
CREATE POLICY "invoices_select_authenticated" ON public.invoices
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "invoices_insert_authenticated" ON public.invoices
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "invoice_items_select_authenticated" ON public.invoice_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "invoice_items_insert_authenticated" ON public.invoice_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ================================================
-- VERIFICACIÓN
-- ================================================
SELECT 'Tablas de facturas creadas correctamente' AS status;
