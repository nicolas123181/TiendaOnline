-- =====================================================
-- Agregar tabla para direcciones de envío de usuarios
-- Ejecutar en el SQL Editor de Supabase Dashboard
-- =====================================================

-- Crear tabla para guardar direcciones de envío
CREATE TABLE IF NOT EXISTS user_shipping_addresses (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    address TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    city TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_user_shipping_addresses_user_id ON user_shipping_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_shipping_addresses_default ON user_shipping_addresses(user_id, is_default) WHERE is_default = true;

-- Habilitar RLS (Row Level Security)
ALTER TABLE user_shipping_addresses ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver sus propias direcciones
CREATE POLICY "Users can view own shipping addresses" 
ON user_shipping_addresses
FOR SELECT
USING (auth.uid() = user_id);

-- Política: Los usuarios pueden insertar sus propias direcciones
CREATE POLICY "Users can insert own shipping addresses"
ON user_shipping_addresses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden actualizar sus propias direcciones
CREATE POLICY "Users can update own shipping addresses"
ON user_shipping_addresses
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden eliminar sus propias direcciones
CREATE POLICY "Users can delete own shipping addresses"
ON user_shipping_addresses
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_user_shipping_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_shipping_addresses_updated_at_trigger
BEFORE UPDATE ON user_shipping_addresses
FOR EACH ROW
EXECUTE FUNCTION update_user_shipping_addresses_updated_at();

-- Trigger para asegurar que solo haya una dirección por defecto por usuario
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE user_shipping_addresses
        SET is_default = false
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_address_trigger
BEFORE INSERT OR UPDATE ON user_shipping_addresses
FOR EACH ROW
WHEN (NEW.is_default = true)
EXECUTE FUNCTION ensure_single_default_address();
