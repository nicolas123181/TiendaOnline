#!/bin/bash
# Script de verificación rápida de correcciones
# Uso: bash VERIFICACION_RAPIDA.sh

echo "🔍 Verificando correcciones de bugs..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Test 1: BRAND_COLORS_EMAIL definido
echo -n "1️⃣  [Verificando] BRAND_COLORS_EMAIL en email.ts... "
if grep -q "const BRAND_COLORS_EMAIL = {" src/lib/email.ts; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FALLA${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Test 2: NO hay BRAND_COLORS sin _EMAIL en email.ts
echo -n "2️⃣  [Verificando] Sin BRAND_COLORS (solo _EMAIL) en template... "
if ! grep "BRAND_COLORS\." src/lib/email.ts | grep -v "_EMAIL" | grep -q "BRAND_COLORS"; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ Encontrado BRAND_COLORS sin _EMAIL${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Test 3: order_items validación
echo -n "3️⃣  [Verificando] Validación de order_items... "
if grep -q "if (!order.order_items" src/pages/api/orders/cancel.ts; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FALLA${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Test 4: RPC error throw
echo -n "4️⃣  [Verificando] RPC error handling (throw)... "
if grep -A1 "const { error: rpcError }" src/pages/api/orders/cancel.ts | grep -q "throw new Error"; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FALLA${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Test 5: product_sizes error handling
echo -n "5️⃣  [Verificando] product_sizes error validation... "
if grep -q "if (fetchError)" src/pages/api/orders/cancel.ts && grep -q "throw new Error.*fetch product size" src/pages/api/orders/cancel.ts; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FALLA${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Test 6: Catch handler mejorado
echo -n "6️⃣  [Verificando] Catch handler con error específico... "
if grep -A3 "} catch (error)" src/pages/api/orders/cancel.ts | grep -q "errorMessage"; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FALLA${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "=================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ TODAS LAS CORRECCIONES VERIFICADAS${NC}"
    echo ""
    echo "Próximos pasos:"
    echo "1. npm run build"
    echo "2. Probar en desarrollo"
    echo "3. Deploy a producción"
    exit 0
else
    echo -e "${RED}❌ SE ENCONTRARON $ERRORS ERRORES${NC}"
    echo ""
    echo "Revisa los archivos modificados:"
    echo "- src/lib/email.ts"
    echo "- src/pages/api/orders/cancel.ts"
    exit 1
fi
