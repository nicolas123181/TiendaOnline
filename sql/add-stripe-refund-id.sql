-- =====================================================
-- AÑADIR CAMPO stripe_refund_id A TABLA returns
-- =====================================================
-- Ejecutar en Supabase SQL Editor

ALTER TABLE returns ADD COLUMN IF NOT EXISTS stripe_refund_id VARCHAR(255);

-- Índice para búsquedas por refund_id
CREATE INDEX IF NOT EXISTS idx_returns_stripe_refund ON returns(stripe_refund_id);

-- Comentario descriptivo
COMMENT ON COLUMN returns.stripe_refund_id IS 'ID del reembolso en Stripe (re_...)';
