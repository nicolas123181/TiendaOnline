-- COMPLETE DATABASE SCHEMA FOR FASHIONSHOP
-- Execute this script in Supabase SQL Editor to set up your database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS categories_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.categories (
  id integer NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
  name character varying NOT NULL,
  slug character varying NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS products_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.products (
  id integer NOT NULL DEFAULT nextval('products_id_seq'::regclass),
  name character varying NOT NULL,
  slug character varying NOT NULL UNIQUE,
  description text,
  price integer NOT NULL CHECK (price > 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id integer,
  images text[] DEFAULT '{}'::text[],
  featured boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL
);

-- ============================================================
-- ADMIN USERS (for admin panel access)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS admin_users_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.admin_users (
  id integer NOT NULL DEFAULT nextval('admin_users_id_seq'::regclass),
  email character varying NOT NULL UNIQUE,
  role character varying DEFAULT 'admin'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_users_pkey PRIMARY KEY (id)
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS orders_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.orders (
  id integer NOT NULL DEFAULT nextval('orders_id_seq'::regclass),
  customer_email character varying NOT NULL,
  customer_name character varying NOT NULL,
  customer_address text NOT NULL,
  customer_city character varying NOT NULL,
  customer_postal_code character varying NOT NULL,
  customer_phone character varying,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'paid'::character varying, 'shipped'::character varying, 'delivered'::character varying, 'cancelled'::character varying]::text[])),
  total integer NOT NULL,
  stripe_payment_intent_id character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id)
);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS order_items_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.order_items (
  id integer NOT NULL DEFAULT nextval('order_items_id_seq'::regclass),
  order_id integer NOT NULL,
  product_id integer,
  product_name character varying NOT NULL,
  product_price integer NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  size character varying,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL
);

-- ============================================================
-- SHIPPING METHODS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS shipping_methods_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.shipping_methods (
  id integer NOT NULL DEFAULT nextval('shipping_methods_id_seq'::regclass),
  name character varying NOT NULL,
  description text,
  cost integer NOT NULL,
  min_days integer NOT NULL,
  max_days integer NOT NULL,
  min_order_amount integer,
  max_weight_grams integer,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shipping_methods_pkey PRIMARY KEY (id)
);

-- Insert default shipping methods
INSERT INTO public.shipping_methods (name, description, cost, min_days, max_days, display_order) 
VALUES 
  ('Envío Estándar', 'Entrega en 5-7 días hábiles', 500, 5, 7, 1),
  ('Envío Rápido', 'Entrega en 2-3 días hábiles', 1000, 2, 3, 2),
  ('Envío Express', 'Entrega al día siguiente', 1999, 1, 1, 3)
ON CONFLICT DO NOTHING;

-- ============================================================
-- COUPONS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS coupons_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.coupons (
  id integer NOT NULL DEFAULT nextval('coupons_id_seq'::regclass),
  code character varying NOT NULL UNIQUE,
  discount_type character varying NOT NULL CHECK (discount_type::text = ANY (ARRAY['percentage'::character varying, 'fixed'::character varying]::text[])),
  discount_value integer NOT NULL,
  max_uses integer,
  used_count integer DEFAULT 0,
  min_purchase integer,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupons_pkey PRIMARY KEY (id)
);

-- ============================================================
-- COUPON USAGE
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS coupon_usage_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.coupon_usage (
  id integer NOT NULL DEFAULT nextval('coupon_usage_id_seq'::regclass),
  coupon_id integer NOT NULL,
  order_id integer NOT NULL,
  customer_email character varying NOT NULL,
  discount_applied integer NOT NULL,
  used_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupon_usage_pkey PRIMARY KEY (id),
  CONSTRAINT coupon_usage_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE,
  CONSTRAINT coupon_usage_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE
);

-- ============================================================
-- PRODUCT OFFERS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS product_offers_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.product_offers (
  id integer NOT NULL DEFAULT nextval('product_offers_id_seq'::regclass),
  product_id integer NOT NULL,
  discount_type character varying NOT NULL CHECK (discount_type::text = ANY (ARRAY['percentage'::character varying, 'fixed'::character varying]::text[])),
  discount_value integer NOT NULL,
  original_price integer NOT NULL,
  sale_price integer NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_offers_pkey PRIMARY KEY (id),
  CONSTRAINT product_offers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);

-- ============================================================
-- NOTIFICATIONS (for email queue)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS notifications_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.notifications (
  id integer NOT NULL DEFAULT nextval('notifications_id_seq'::regclass),
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['order_confirmed'::character varying, 'order_shipped'::character varying, 'order_delivered'::character varying, 'stock_low'::character varying]::text[])),
  recipient_email character varying NOT NULL,
  recipient_name character varying,
  order_id integer,
  subject text NOT NULL,
  message text NOT NULL,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'sent'::character varying, 'failed'::character varying]::text[])),
  sent_at timestamp with time zone,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL
);

-- ============================================================
-- PRODUCT VARIANTS (for sizes, colors, etc.)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS product_variants_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.product_variants (
  id integer NOT NULL DEFAULT nextval('product_variants_id_seq'::regclass),
  product_id integer NOT NULL,
  variant_type character varying NOT NULL,
  variant_value character varying NOT NULL,
  sku character varying,
  stock_adjustment integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_variants_pkey PRIMARY KEY (id),
  CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS customers_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.customers (
  id integer NOT NULL DEFAULT nextval('customers_id_seq'::regclass),
  email character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  phone character varying,
  default_address text,
  default_city character varying,
  default_postal_code character varying,
  total_spent integer DEFAULT 0,
  total_orders integer DEFAULT 0,
  is_subscribed_newsletter boolean DEFAULT true,
  last_order_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);

-- ============================================================
-- LOW STOCK ALERTS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS low_stock_alerts_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.low_stock_alerts (
  id integer NOT NULL DEFAULT nextval('low_stock_alerts_id_seq'::regclass),
  product_id integer NOT NULL,
  threshold integer NOT NULL DEFAULT 10,
  current_stock integer,
  alert_sent boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT low_stock_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT low_stock_alerts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);

-- ============================================================
-- APP SETTINGS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS app_settings_id_seq START 1 INCREMENT 1;
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer NOT NULL DEFAULT nextval('app_settings_id_seq'::regclass),
  key character varying NOT NULL UNIQUE,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (id)
);

-- Insert default settings
INSERT INTO public.app_settings (key, value)
VALUES 
  ('flash_offers_enabled', 'false'),
  ('newsletter_enabled', 'true'),
  ('store_open', 'true')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Optional but recommended
-- ============================================================
-- You can enable RLS per table for additional security
-- Example:
-- ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Only admins can view admin_users"
--   ON public.admin_users
--   FOR SELECT
--   TO authenticated
--   USING (email = current_user_id);
