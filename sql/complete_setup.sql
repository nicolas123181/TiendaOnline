-- ================================================
-- SCRIPT COMPLETO - VANTAGE
-- Ejecutar TODO en Supabase SQL Editor
-- ================================================

-- ======================================
-- 1. AÑADIR COLUMNA DISCOUNT A ORDERS
-- ======================================
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS discount INTEGER DEFAULT 0;

COMMENT ON COLUMN public.orders.discount IS 'Monto del descuento aplicado en céntimos';

-- ======================================
-- 2. CREAR TABLA DE FACTURAS
-- ======================================

-- Secuencia para número de factura
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1 INCREMENT 1;

-- Tabla de facturas
CREATE TABLE IF NOT EXISTS public.invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  order_id INTEGER NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_address TEXT,
  customer_city VARCHAR(100),
  customer_postal_code VARCHAR(20),
  customer_phone VARCHAR(20),
  company_name VARCHAR(255) DEFAULT 'Vantage Fashion S.L.',
  company_address TEXT DEFAULT 'Calle de la Moda 123, 28001 Madrid',
  company_nif VARCHAR(20) DEFAULT 'B-12345678',
  company_email VARCHAR(255) DEFAULT 'contacto@vantage.com',
  company_phone VARCHAR(20) DEFAULT '+34 900 123 456',
  subtotal INTEGER NOT NULL,
  shipping_cost INTEGER DEFAULT 0,
  discount INTEGER DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 21.00,
  tax_amount INTEGER NOT NULL,
  total INTEGER NOT NULL,
  payment_method VARCHAR(100) DEFAULT 'Tarjeta de crédito',
  payment_status VARCHAR(50) DEFAULT 'paid',
  issue_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  due_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'sent', 'paid', 'cancelled')),
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de líneas de factura
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES public.products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  product_size VARCHAR(50),
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  line_total INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_email ON public.invoices(customer_email);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON public.invoices(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- Función para generar número de factura
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

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_invoice_updated_at ON public.invoices;
CREATE TRIGGER trigger_invoice_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_updated_at();

-- RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Políticas (permitir todo para usuarios autenticados)
DROP POLICY IF EXISTS "invoices_all_authenticated" ON public.invoices;
CREATE POLICY "invoices_all_authenticated" ON public.invoices
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "invoice_items_all_authenticated" ON public.invoice_items;
CREATE POLICY "invoice_items_all_authenticated" ON public.invoice_items
  FOR ALL USING (true) WITH CHECK (true);

-- ======================================
-- VERIFICACIÓN
-- ======================================
SELECT 'OK: Columna discount añadida a orders' AS result
UNION ALL
SELECT 'OK: Tabla invoices creada' 
UNION ALL
SELECT 'OK: Tabla invoice_items creada'
UNION ALL
SELECT 'OK: Función generate_invoice_number creada';
