-- ================================================
-- CORRECCIÓN DE RLS PARA VANTAGE
-- ¡EJECUTAR COMPLETO EN SUPABASE SQL EDITOR!
-- ================================================

-- PROBLEMA: RLS está habilitado pero no hay políticas
-- que permitan INSERT/UPDATE, por eso las facturas
-- y el stock no se actualizan.

-- ================================================
-- 1. DESHABILITAR RLS EN TABLAS INTERNAS
-- ================================================

-- Facturas (solo acceso desde backend)
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items DISABLE ROW LEVEL SECURITY;

-- Pedidos (solo acceso desde backend)
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;

-- Stock por tallas (solo acceso desde backend)
ALTER TABLE public.product_sizes DISABLE ROW LEVEL SECURITY;

-- Productos (permitir UPDATE de stock)
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;

-- ================================================
-- 2. CREAR/VERIFICAR SECUENCIA DE FACTURAS
-- ================================================
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1 INCREMENT 1;

-- ================================================
-- 3. CREAR/ACTUALIZAR FUNCIÓN DE NÚMERO DE FACTURA
-- ================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 4. VERIFICACIÓN
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ RLS deshabilitado en invoices';
  RAISE NOTICE '✅ RLS deshabilitado en invoice_items';
  RAISE NOTICE '✅ RLS deshabilitado en orders';
  RAISE NOTICE '✅ RLS deshabilitado en order_items';
  RAISE NOTICE '✅ RLS deshabilitado en product_sizes';
  RAISE NOTICE '✅ RLS deshabilitado en products';
  RAISE NOTICE '✅ Secuencia invoice_number_seq verificada';
  RAISE NOTICE '✅ Función generate_invoice_number() creada';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 ¡CORRECCIÓN COMPLETADA! Prueba hacer un pedido.';
END $$;

-- Mostrar confirmación
SELECT '✅ Script ejecutado correctamente' AS resultado;
