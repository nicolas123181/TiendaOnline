# ✅ Checklist de Verificación Post-Correcciones

## 🔍 Verificaciones Técnicas Rápidas

### 1. Verificar que email.ts tiene BRAND_COLORS_EMAIL
```bash
# Buscar en archivo
grep -n "BRAND_COLORS_EMAIL" src/lib/email.ts
# Debe retornar linea con const BRAND_COLORS_EMAIL = {...}
```
**Expected Output**: Línea que define `const BRAND_COLORS_EMAIL`

---

### 2. Verificar que NO hay BRAND_COLORS sin _EMAIL
```bash
grep -n "BRAND_COLORS\." src/lib/email.ts | grep -v "_EMAIL"
# NO debe retornar nada en la función sendCancelledOrderAdminAlert
```
**Expected Output**: Vacío (sin resultados)

---

### 3. Verificar que cancel.ts valida order_items
```bash
grep -n "if (!order.order_items" src/pages/api/orders/cancel.ts
# Debe encontrar la validación
```
**Expected Output**: Línea con la validación

---

### 4. Verificar que RPC error se lanza (no solo log)
```bash
grep -n "throw new Error.*RPC\|increment_stock" src/pages/api/orders/cancel.ts
# Debe encontrar throw new Error
```
**Expected Output**: Línea con `throw new Error` para RPC

---

### 5. Verificar que catch handler reporta error específico
```bash
grep -A5 "} catch (error)" src/pages/api/orders/cancel.ts | grep "errorMessage"
# Debe mostrar que se usa error.message
```
**Expected Output**: Uso de `errorMessage` en la respuesta

---

## 🧪 Pruebas Funcionales

### Test A: Cancelación Exitosa
```
[ ] 1. Login como usuario con pedido estado "paid"
[ ] 2. Ir a Perfil → Ver Pedido
[ ] 3. Clickear botón "Cancelar Pedido"
[ ] 4. Confirmar en modal
[ ] ✅ Esperado: Página recarga sin error
[ ] ✅ Esperado: Pedido cambia a "cancelled"
[ ] ✅ Esperado: Stock aumenta en inventario
```

### Test B: Email al Cliente
```
[ ] 1. Completar Test A
[ ] 2. Revisar inbox del cliente
[ ] ✅ Esperado: Email 1 "Cancelación en Curso" (inmediato)
[ ] ✅ Esperado: Email 2 "Pedido Cancelado + monto" (dentro de 1s)
[ ] ✅ Esperado: Ambos con logo VANTAGE y colores correctos
```

### Test C: Email al Admin
```
[ ] 1. Completar Test A
[ ] 2. Esperar 3-5 segundos
[ ] 3. Revisar inbox de p2590149@gmail.com
[ ] ✅ Esperado: Email "Pedido Cancelado por Cliente"
[ ] ✅ Esperado: Contiene número de pedido, cliente, monto
[ ] ✅ Esperado: Lista de productos con stock restaurado
[ ] ✅ Esperado: Colores correctos (NO error de color)
```

### Test D: Restauración de Stock
```
[ ] 1. Anotar stock inicial de producto (ej: Talla M = 5)
[ ] 2. Vender 2 unidades (stock queda en 3)
[ ] 3. Completar Test A (cancelar)
[ ] 4. Revisar producto
[ ] ✅ Esperado: Stock vuelve a 5
[ ] ✅ Esperado: Por talla se restauró correctamente
```

### Test E: Protección contra Duplicados
```
[ ] 1. Ir a pedido en estado "paid"
[ ] 2. Clickear "Cancelar" rápidamente 3-4 veces
[ ] ✅ Esperado: Botón deshabilitado después del 1er click
[ ] ✅ Esperado: Solo 1 cancelación se procesa
[ ] ✅ Esperado: Sin error si se retry después de completado
```

### Test F: Manejo de Errores
```
[ ] 1. Simular error (desconectar BD, etc)
[ ] 2. Clickear "Cancelar"
[ ] ✅ Esperado: Mensaje de error ESPECÍFICO (no genérico)
[ ] ✅ Esperado: Botón se re-habilita para reintentar
[ ] ✅ Esperado: Error aparece en console logs detallado
```

---

## 📊 Verificación de Logs

### En consola del navegador (DevTools)
```
Buscar: "🔍 Debug Cancel"
```
**Debe mostrar** progreso de cada paso:
- ✅ Autenticación
- ✅ Obtención de pedido
- ✅ Reembolso Stripe
- ✅ Restauración de stock
- ✅ Actualización de estado

### En servidor (logs)
```
Buscar: "Cancel order"
```
**Debe mostrar**:
- ✅ Inicio de cancelación
- ✅ Reembolso Stripe (monto, ID)
- ✅ Restauración de stock (por talla)
- ✅ Email a admin (2s después)

---

## 🐛 Si Encuentras Problemas

### Problema: Email al admin NO llega
**Checklist**:
```
[ ] Verificar que BRAND_COLORS_EMAIL está definido
[ ] Verificar que NO hay BRAND_COLORS sin _EMAIL
[ ] Revisar logs del servidor: "Error enviando alerta al admin"
[ ] Verificar RESEND_API_KEY en .env
[ ] Probar que setTimeout de 2s se ejecuta
```

### Problema: Stock NO se restaura
**Checklist**:
```
[ ] Verificar orden tiene order_items cargados
[ ] Revisar logs: "Failed to increment stock"
[ ] Revisar logs: "Failed to update size stock"
[ ] Verificar que RPC increment_stock existe en BD
[ ] Verificar que product_sizes tabla tiene el producto
```

### Problema: Error 500 genérico
**Checklist**:
```
[ ] Verificar logs del servidor (debe mostrar error específico)
[ ] Buscar "Cancel order error:" en logs
[ ] Ver si es error de validación, stock, o Stripe
[ ] Revisar stack trace si está disponible
```

### Problema: Múltiples cancelaciones
**Checklist**:
```
[ ] Verificar que botón se desactiva inmediatamente
[ ] Revisar BD: pedido debe tener único refund_id
[ ] Si aparece 2 veces, revertir manualmente o agregar unique constraint
```

---

## 🚀 Deployment Checklist

```
[ ] Revisar cambios en cancel.ts
[ ] Revisar cambios en email.ts
[ ] Ejecutar tests si existen
[ ] Probar en staging
[ ] Probar Email A + B + C + D
[ ] Revisar logs de Stripe/Resend
[ ] Deploy a producción
[ ] Monitorear primeras cancelaciones
[ ] Verificar que admin recibe emails
```

---

## 📞 Contacto para Issues

Si encuentras algún problema:

1. **Revisa los logs del servidor** - Busca línea que comienza con "Cancel order error:"
2. **Copia el error específico** (no "Error interno del servidor")
3. **Prueba reproduciendo** el error con datos de test
4. **Compara con checklist** de errores conocidos arriba

---

**Última actualización**: Correcciones Bug 1-6 aplicadas ✅
