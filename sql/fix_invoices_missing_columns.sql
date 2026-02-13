-- ================================================
-- FIX: Columnas faltantes en tabla invoices
-- EJECUTAR EN SUPABASE SQL EDITOR
-- 
-- PROBLEMA: La función createInvoice() intenta insertar
-- las columnas 'type' y 'original_invoice_id' que NO 
-- existen en la tabla. Esto causa que TODAS las facturas
-- fallen silenciosamente.
-- ================================================

-- 1. Añadir columna 'type' (standard o credit_note)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'invoices' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE public.invoices 
      ADD COLUMN type VARCHAR(50) DEFAULT 'standard' 
      CHECK (type IN ('standard', 'credit_note'));
    RAISE NOTICE '✅ Columna type añadida a invoices';
  ELSE
    RAISE NOTICE 'ℹ️ Columna type ya existe en invoices';
  END IF;
END $$;

-- 2. Añadir columna 'original_invoice_id' (referencia para facturas rectificativas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'invoices' 
    AND column_name = 'original_invoice_id'
  ) THEN
    ALTER TABLE public.invoices 
      ADD COLUMN original_invoice_id INTEGER REFERENCES public.invoices(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Columna original_invoice_id añadida a invoices';
  ELSE
    RAISE NOTICE 'ℹ️ Columna original_invoice_id ya existe en invoices';
  END IF;
END $$;

-- 3. Asegurar que las políticas RLS permiten operaciones anon (para admin SSR)
-- Solo ejecutar si las políticas actuales son restrictivas

-- Verificar si existe la política antigua restrictiva y reemplazarla
DO $$
BEGIN
  -- Eliminar políticas antiguas si existen
  DROP POLICY IF EXISTS "invoices_select_authenticated" ON public.invoices;
  DROP POLICY IF EXISTS "invoices_insert_authenticated" ON public.invoices;
  DROP POLICY IF EXISTS "invoice_items_select_authenticated" ON public.invoice_items;
  DROP POLICY IF EXISTS "invoice_items_insert_authenticated" ON public.invoice_items;
  
  -- Crear/reemplazar con políticas abiertas necesarias para el flujo actual
  DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
  CREATE POLICY "invoices_select" ON public.invoices FOR SELECT USING (true);
  
  DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
  CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT WITH CHECK (true);
  
  DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
  CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE USING (true) WITH CHECK (true);
  
  DROP POLICY IF EXISTS "invoice_items_select" ON public.invoice_items;
  CREATE POLICY "invoice_items_select" ON public.invoice_items FOR SELECT USING (true);
  
  DROP POLICY IF EXISTS "invoice_items_insert" ON public.invoice_items;
  CREATE POLICY "invoice_items_insert" ON public.invoice_items FOR INSERT WITH CHECK (true);
  
  RAISE NOTICE '✅ Políticas RLS de facturas actualizadas';
END $$;

-- 4. Asegurar GRANTs correctos
GRANT SELECT, INSERT, UPDATE ON public.invoices TO anon, authenticated;
GRANT SELECT, INSERT ON public.invoice_items TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 5. Asegurar que la función generate_invoice_number es accesible
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO anon, authenticated;

-- ================================================
-- VERIFICACIÓN
-- ================================================
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'invoices'
  AND column_name IN ('type', 'original_invoice_id')
ORDER BY column_name;
