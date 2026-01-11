-- =====================================================
-- SCHEMA SQL PARA SUPABASE - FASHIONSTORE
-- Ejecutar en el SQL Editor de Supabase Dashboard
-- =====================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA: categories (Categorías de productos)
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Datos iniciales de categorías
INSERT INTO categories (name, slug, description) VALUES
  ('Camisas', 'camisas', 'Camisas elegantes para toda ocasión'),
  ('Camisetas', 'camisetas', 'Camisetas premium de algodón'),
  ('Pantalones', 'pantalones', 'Pantalones de vestir y casuales'),
  ('Trajes', 'trajes', 'Trajes completos de alta costura'),
  ('Chalecos', 'chalecos', 'Chalecos formales e informales'),
  ('Abrigos', 'abrigos', 'Abrigos y chaquetas de temporada')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- TABLA: products (Productos)
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  price INTEGER NOT NULL CHECK (price > 0), -- Precio en céntimos
  sale_price INTEGER DEFAULT NULL CHECK (sale_price IS NULL OR sale_price > 0), -- Precio de oferta
  is_on_sale BOOLEAN DEFAULT FALSE, -- Si está en oferta flash
  sale_ends_at TIMESTAMPTZ DEFAULT NULL, -- Cuándo termina la oferta
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  images TEXT[] DEFAULT '{}', -- Array de URLs de imágenes
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sale ON products(is_on_sale);

-- =====================================================
-- TABLA: orders (Pedidos)
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_address TEXT NOT NULL,
  customer_city VARCHAR(100) NOT NULL,
  customer_postal_code VARCHAR(20) NOT NULL,
  customer_phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  total INTEGER NOT NULL, -- Total en céntimos
  stripe_payment_intent_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);

-- =====================================================
-- TABLA: order_items (Items de pedido)
-- =====================================================
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL, -- Guardar nombre por si el producto se elimina
  product_price INTEGER NOT NULL, -- Guardar precio al momento de la compra
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  size VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- =====================================================
-- TABLA: app_settings (Configuración de la app)
-- =====================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuración inicial
INSERT INTO app_settings (key, value) VALUES
  ('flash_offers_enabled', 'true'),
  ('store_name', 'FashionStore'),
  ('store_email', 'info@fashionstore.com')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- FUNCIÓN: Decrementar stock atómicamente
-- Previene vender más unidades de las disponibles
-- =====================================================
CREATE OR REPLACE FUNCTION decrement_stock(
  p_product_id INTEGER,
  p_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  -- Bloquear la fila para evitar race conditions
  SELECT stock INTO current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;
  
  -- Verificar si hay suficiente stock
  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;
  
  IF current_stock < p_quantity THEN
    RETURN FALSE; -- No hay suficiente stock
  END IF;
  
  -- Decrementar stock
  UPDATE products
  SET stock = stock - p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN: Trigger para actualizar updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at automático
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- CATEGORIES: Lectura pública, escritura solo autenticados
CREATE POLICY "Categories are viewable by everyone"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Categories are editable by authenticated users"
  ON categories FOR ALL
  USING (auth.role() = 'authenticated');

-- PRODUCTS: Lectura pública, escritura solo autenticados
CREATE POLICY "Products are viewable by everyone"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Products are editable by authenticated users"
  ON products FOR ALL
  USING (auth.role() = 'authenticated');

-- ORDERS: Solo accesible por autenticados (admin)
CREATE POLICY "Orders are only viewable by authenticated users"
  ON orders FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Orders are editable by authenticated users"
  ON orders FOR ALL
  USING (auth.role() = 'authenticated');

-- ORDER_ITEMS: Solo accesible por autenticados (admin)
CREATE POLICY "Order items are only viewable by authenticated users"
  ON order_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Order items are editable by authenticated users"
  ON order_items FOR ALL
  USING (auth.role() = 'authenticated');

-- APP_SETTINGS: Lectura pública, escritura solo autenticados
CREATE POLICY "App settings are viewable by everyone"
  ON app_settings FOR SELECT
  USING (true);

CREATE POLICY "App settings are editable by authenticated users"
  ON app_settings FOR ALL
  USING (auth.role() = 'authenticated');

-- =====================================================
-- DATOS DE EJEMPLO (Productos)
-- =====================================================
INSERT INTO products (name, slug, description, price, stock, category_id, featured, images) VALUES
  (
    'Camisa Oxford Premium',
    'camisa-oxford-premium',
    'Camisa Oxford de algodón 100% con cuello abotonado. Perfecta para ocasiones formales e informales. Confeccionada con los mejores materiales para garantizar comodidad y durabilidad.',
    4999, -- 49.99€
    25,
    1,
    TRUE,
    ARRAY['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800']
  ),
  (
    'Camisa de Lino Italiana',
    'camisa-lino-italiana',
    'Camisa de lino puro importada de Italia. Ideal para climas cálidos y eventos veraniegos. Tejido transpirable de primera calidad.',
    7999, -- 79.99€
    15,
    1,
    TRUE,
    ARRAY['https://images.unsplash.com/photo-1598032895397-b9472444bf93?w=800']
  ),
  (
    'Camiseta Essential Negra',
    'camiseta-essential-negra',
    'Camiseta básica de algodón pima premium. Corte regular fit con cuello redondo reforzado. El básico perfecto para cualquier armario.',
    2999, -- 29.99€
    50,
    2,
    FALSE,
    ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800']
  ),
  (
    'Pantalón Chino Slim Fit',
    'pantalon-chino-slim-fit',
    'Pantalón chino de corte slim en algodón elástico. Cintura media con cierre de botón y cremallera. Disponible en múltiples colores.',
    5999, -- 59.99€
    30,
    3,
    TRUE,
    ARRAY['https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800']
  ),
  (
    'Traje Ejecutivo Azul Marino',
    'traje-ejecutivo-azul-marino',
    'Traje de dos piezas en lana italiana azul marino. Corte moderno con solapas de muesca. Incluye pantalón a juego.',
    29999, -- 299.99€
    8,
    4,
    TRUE,
    ARRAY['https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800']
  ),
  (
    'Chaleco de Vestir Gris',
    'chaleco-vestir-gris',
    'Chaleco formal en tejido de espiga gris. Espalda ajustable y bolsillos con solapa. Perfecto para completar tu look de ocasión.',
    6999, -- 69.99€
    12,
    5,
    FALSE,
    ARRAY['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800']
  ),
  (
    'Abrigo de Lana Camel',
    'abrigo-lana-camel',
    'Abrigo largo de lana y cashmere en color camel. Corte clásico con cuello de solapa. El complemento perfecto para el invierno.',
    24999, -- 249.99€
    5,
    6,
    TRUE,
    ARRAY['https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=800']
  ),
  (
    'Camiseta Polo Premium',
    'camiseta-polo-premium',
    'Polo de piqué de algodón con logo bordado. Cuello y puños acanalados. Estilo casual elegante.',
    4499, -- 44.99€
    40,
    2,
    FALSE,
    ARRAY['https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=800']
  )
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- TABLA: newsletter_subscribers (Suscriptores del Newsletter)
-- =====================================================
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- Índice para búsqueda por email
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_subscribers(is_active);

-- Política de seguridad
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver y modificar su propia suscripción
CREATE POLICY "Users can manage own subscription" ON newsletter_subscribers
  FOR ALL USING (auth.jwt() ->> 'email' = email);

-- El admin puede ver todos
CREATE POLICY "Admin can view all subscribers" ON newsletter_subscribers
  FOR SELECT USING (auth.role() = 'authenticated');

-- =====================================================
-- FIN DEL SCHEMA
-- =====================================================
