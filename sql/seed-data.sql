-- DATOS DE PRUEBA PARA FASHIONSHOP
-- Ejecuta estos comandos en Supabase SQL Editor después de crear el schema

-- =============================================================================
-- 1. CATEGORÍAS DE PRUEBA
-- =============================================================================
INSERT INTO public.categories (name, slug, description)
VALUES
  ('Camisas', 'camisas', 'Camisas de hombre y mujer para todas las ocasiones'),
  ('Pantalones', 'pantalones', 'Pantalones cómodos y elegantes'),
  ('Accesorios', 'accesorios', 'Accesorios para completar tu look')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 2. PRODUCTOS DE PRUEBA
-- =============================================================================
INSERT INTO public.products (name, slug, description, price, stock, category_id, images, featured, created_at)
VALUES
  (
    'Camisa de Lino Italiana',
    'camisa-lino-italiana',
    'Camisa 100% lino natural. Perfecta para verano. Disponible en múltiples tallas.',
    15998,
    50,
    1,
    ARRAY[
      'https://via.placeholder.com/500x500?text=Camisa+Lino+1',
      'https://via.placeholder.com/500x500?text=Camisa+Lino+2'
    ],
    true,
    now()
  ),
  (
    'Camiseta Básica Negra',
    'camiseta-basica-negra',
    'Camiseta de algodón 100% orgánico. Cómoda y versátil.',
    1499,
    100,
    1,
    ARRAY[
      'https://via.placeholder.com/500x500?text=Camiseta+Negra'
    ],
    true,
    now()
  ),
  (
    'Pantalón Vaquero Slim',
    'pantalon-vaquero-slim',
    'Pantalón vaquero azul oscuro con corte slim. Perfecto uso diario.',
    6999,
    30,
    2,
    ARRAY[
      'https://via.placeholder.com/500x500?text=Vaquero+Slim'
    ],
    true,
    now()
  ),
  (
    'Cinturón Cuero Premium',
    'cinturon-cuero-premium',
    'Cinturón de cuero auténtico. Hebilla ajustable. Ideal para formalidad.',
    3999,
    25,
    3,
    ARRAY[
      'https://via.placeholder.com/500x500?text=Cinturon'
    ],
    false,
    now()
  )
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 3. CUPÓN DE PRUEBA (10% descuento)
-- =============================================================================
INSERT INTO public.coupons (code, discount_type, discount_value, max_uses, min_purchase, start_date, end_date, is_active)
VALUES
  (
    'BIENVENIDA10',
    'percentage',
    10,  -- 10% de descuento
    100,  -- máximo 100 usos
    5000,  -- mínimo de compra: 50€ (5000 centavos)
    now(),
    now() + interval '30 days',  -- válido 30 días
    true
  ),
  (
    'ENVIO5',
    'fixed',
    500,  -- 5€ de descuento fijo
    50,
    2000,  -- mínimo 20€
    now(),
    now() + interval '30 days',
    true
  )
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 4. ADMIN USER DE PRUEBA
-- =============================================================================
INSERT INTO public.admin_users (email, role)
VALUES
  ('admin@fashionshop.com', 'admin'),
  ('gerente@fashionshop.com', 'manager')
ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- 5. OFERTAS DE PRODUCTOS (Descuentos especiales)
-- =============================================================================
-- Oferta: 20% de descuento en Camiseta Básica
INSERT INTO public.product_offers (product_id, discount_type, discount_value, original_price, sale_price, start_date, end_date, is_active)
SELECT 
  id,
  'percentage',
  20,  -- 20% descuento
  price,
  (price * 0.8)::integer,  -- 80% del precio original
  now(),
  now() + interval '7 days',
  true
FROM public.products
WHERE slug = 'camiseta-basica-negra'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- VERIFICACIÓN - Ejecuta estas consultas para confirmar:
-- =============================================================================

-- Ver categorías
-- SELECT * FROM public.categories;

-- Ver productos
-- SELECT * FROM public.products;

-- Ver cupones
-- SELECT code, discount_type, discount_value FROM public.coupons;

-- Ver admins
-- SELECT email FROM public.admin_users;

-- Ver ofertas
-- SELECT * FROM public.product_offers;

-- Ver métodos de envío (ya insertados automáticamente)
-- SELECT * FROM public.shipping_methods;
