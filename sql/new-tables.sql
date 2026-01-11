-- ================================================
-- FASHIONSTORE - NUEVAS TABLAS Y MODIFICACIONES
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- 1. TABLA DE PRECIOS ESPECIALES (para ofertas con descuentos)
CREATE TABLE IF NOT EXISTS public.product_offers (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value INTEGER NOT NULL,
  original_price INTEGER NOT NULL,
  sale_price INTEGER NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_offers_product_id ON public.product_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_offers_active ON public.product_offers(is_active, start_date, end_date);

-- 2. TABLA DE CUPONES/DESCUENTOS
CREATE TABLE IF NOT EXISTS public.coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value INTEGER NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  min_purchase INTEGER,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(is_active);

-- 3. TABLA DE USO DE CUPONES (auditoría)
CREATE TABLE IF NOT EXISTS public.coupon_usage (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES public.coupons(id),
  order_id INTEGER NOT NULL REFERENCES public.orders(id),
  customer_email VARCHAR(255) NOT NULL,
  discount_applied INTEGER NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. TABLA DE GASTOS DE ENVÍO
CREATE TABLE IF NOT EXISTS public.shipping_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cost INTEGER NOT NULL,
  min_days INTEGER NOT NULL,
  max_days INTEGER NOT NULL,
  min_order_amount INTEGER,
  max_weight_grams INTEGER,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. TABLA DE NOTIFICACIONES/EVENTOS
CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK (type IN ('order_confirmed', 'order_shipped', 'order_delivered', 'stock_low')),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  order_id INTEGER REFERENCES public.orders(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_pending ON public.notifications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_email ON public.notifications(recipient_email);

-- 6. TABLA DE VARIANTES DE PRODUCTOS (para tallas, colores, etc.)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_type VARCHAR(50) NOT NULL,
  variant_value VARCHAR(100) NOT NULL,
  sku VARCHAR(100),
  stock_adjustment INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, variant_type, variant_value)
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);

-- 7. TABLA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.customers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  default_address TEXT,
  default_city VARCHAR(100),
  default_postal_code VARCHAR(20),
  total_spent INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  is_subscribed_newsletter BOOLEAN DEFAULT true,
  last_order_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

-- 8. TABLA DE STOCK BAJO (alertas)
CREATE TABLE IF NOT EXISTS public.low_stock_alerts (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  threshold INTEGER NOT NULL DEFAULT 10,
  current_stock INTEGER,
  alert_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 9. MODIFICACIONES A TABLA ORDERS - Agregar campos
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_id INTEGER REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_discount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_method_id INTEGER REFERENCES public.shipping_methods(id),
  ADD COLUMN IF NOT EXISTS shipping_cost INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(255);

-- 10. TABLA DE ADMIN USUARIOS (para control de acceso)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(50) DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================
-- DATOS DE EJEMPLO
-- ================================================

-- Insertar métodos de envío por defecto (si no existen)
INSERT INTO public.shipping_methods (name, description, cost, min_days, max_days, min_order_amount, is_active, display_order)
VALUES
  ('Envío Estándar', 'Entrega en 5-7 días laborales', 499, 5, 7, NULL, true, 1),
  ('Envío Express', 'Entrega en 24-48 horas', 999, 1, 2, 3000, true, 2),
  ('Recogida en tienda', 'Recoge tu pedido en nuestra tienda', 0, 1, 1, NULL, true, 3)
ON CONFLICT DO NOTHING;

-- ================================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ================================================

-- Habilitar RLS para nuevas tablas
ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Políticas para product_offers (pública para lectura, admin para escritura)
CREATE POLICY "product_offers_select" ON public.product_offers
  FOR SELECT USING (true);

CREATE POLICY "product_offers_insert" ON public.product_offers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Políticas para shipping_methods (pública para lectura)
CREATE POLICY "shipping_methods_select" ON public.shipping_methods
  FOR SELECT USING (true);

-- Política para admin_users (solo admins pueden ver/editar)
CREATE POLICY "admin_users_select" ON public.admin_users
  FOR SELECT USING (auth.role() = 'authenticated');

-- ================================================
-- DONE
-- ================================================
