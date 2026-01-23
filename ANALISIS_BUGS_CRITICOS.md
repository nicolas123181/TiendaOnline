# 🚨 ANÁLISIS DE ERRORES CRÍTICOS - CANCELACIÓN DE PEDIDOS

**Fecha:** 21 de Enero de 2026  
**Status:** 🔴 BUGS CRÍTICOS IDENTIFICADOS  
**Prioridad:** MÁXIMA

---

## 📋 PROBLEMAS REPORTADOS Y CONFIRMADOS

### 1. ❌ Error interno del servidor (500)
### 2. ❌ Cancelación se solicita múltiples veces
### 3. ❌ No llega email al dueño/admin
### 4. ❌ Stock no se restaura

---

## 🔍 ANÁLISIS PROFUNDO DE CADA PROBLEMA

### 🚨 PROBLEMA 1: Error interno (500)

**Ubicación:** Línea 239 en `cancel.ts`

```typescript
catch (error) {
    console.error('Cancel order error:', error);
    return new Response(JSON.stringify({
        success: false,
        error: 'Error interno del servidor'
    }), { status: 500 });
}
```

**Causa raíz:** El catch captura TODOS los errores pero solo devuelve "Error interno del servidor" sin detalles.

**Problemas en el código:**

#### 🔴 BUG 1A: Acceso a `order.order_items` sin validar tipo

**Línea 140:** 
```typescript
for (const item of order.order_items) {
```

**Problema:** `order_items` podría ser:
- ❌ `undefined` si la relación no se cargó
- ❌ `null` si la BD devuelve null
- ❌ Array vacío ✅ (esto sí funciona)

**Resultado:** Si `order_items` es undefined → `for (const item of undefined)` → ERROR → Cae en catch → 500

---

#### 🔴 BUG 1B: Variable `BRAND_COLORS` no existe en email.ts

**Línea 1377 en email.ts:**
```typescript
const html = `
    <style>
        body { ... background: ${BRAND_COLORS.red}; }
```

**Problema:** `BRAND_COLORS` NO está definida en `email.ts`

**El error es:**
```
ReferenceError: BRAND_COLORS is not defined
```

**Resultado:** Cuando intenta enviar el email al admin → Error → Cae en catch → NO LLEGA EMAIL AL ADMIN

---

#### 🔴 BUG 1C: Template string con salto de línea inválido

**Línea 1419 en email.ts:**
```typescript
            ` : ''}\n
            <center>
```

**Problema:** El `\n` literal en template string DENTRO del HTML causa problemas de interpolación

**Resultado:** Puede causar que el template se malinterprete

---

### 🚨 PROBLEMA 2: Cancelación múltiple

**Causa:** El botón de cancelación en el frontend NO está deshabilitado después del click

**Ubicación:** `src/pages/pedido/[id].astro` línea 728

```typescript
btn.disabled = true;
btn.innerHTML = `...Cancelando...`;

try {
    const response = await fetch("/api/orders/cancel", {
        // ...
    });
    
    if (result.success) {
        alert("✅ " + result.message);
        window.location.reload();  // ← Esto recarga, pero antes del reload...
    } else {
        btn.disabled = false;  // ← Aquí vuelve a habilitar si falla
    }
}
```

**Problema:** Si el usuario hace click rápidamente ANTES de que se procese, o si hay un error que vuelve a habilitar el botón, puede hacer múltiples requests.

**Pero el REAL problema es:** El endpoint NO TIENE IDEMPOTENCIA - Si llega dos veces el mismo orderId, va a:
1. Primera vez: Cancela, restaura stock, envía emails
2. Segunda vez: Intenta cancelar un pedido que YA ESTÁ en estado "cancelled" → 400 error

**Pero el frontend sigue insistiendo porque NO recibe el error correctamente**

---

### 🚨 PROBLEMA 3: Email no llega al admin

**Razón:** `BRAND_COLORS` no existe en email.ts

**Cuando se intenta enviar:**
```typescript
const { sendCancelledOrderAdminAlert } = await import('../../../lib/email');

await sendCancelledOrderAdminAlert({...});
```

**El código llega a:**
```typescript
const html = `
    <style>
        background: ${BRAND_COLORS.red}; // ← ReferenceError aquí
```

**Resultado:** 
- ❌ Error en la función
- ❌ `return false;` en el catch
- ❌ El console.warn se ejecuta pero no llega el email
- ❌ El usuario ve "El administrador ha sido notificado" pero es FALSO

---

### 🚨 PROBLEMA 4: Stock no se restaura

**Hay 2 problemas:**

#### 🔴 BUG 4A: Falla silenciosa en RPC

**Línea 144:**
```typescript
const { error: rpcError } = await adminClient.rpc('increment_stock', {
    product_id_param: item.product_id,
    quantity_param: item.quantity
});

if (rpcError) console.error('RPC Error:', rpcError);  // ← Solo log, NO detiene
```

**Problema:** 
- Si el RPC falla, solo hace un `console.error` pero CONTINÚA
- El resto del código sigue ejecutándose
- El stock NO se restaura pero el usuario piensa que sí

---

#### 🔴 BUG 4B: product_sizes query podría fallar

**Línea 153:**
```typescript
if (item.size) {
    const { data: sizeStock } = await adminClient
        .from('product_sizes')
        .select('stock')
        .eq('product_id', item.product_id)
        .eq('size', item.size)
        .single();

    if (sizeStock) {  // ← Aquí verifica si existe
        await adminClient
            .from('product_sizes')
            .update({ stock: sizeStock.stock + item.quantity })
            .eq('product_id', item.product_id)
            .eq('size', item.size);
    }
}
```

**Problemas:**
- ❌ No captura error si falla la query
- ❌ No verifica si el update funcionó
- ❌ Si `sizeStock` es undefined, simplemente NO ACTUALIZA (sin error)

---

## 🎯 RESUMEN DE BUGS

| # | Bug | Severidad | Línea | Archivo | Impacto |
|---|-----|-----------|-------|---------|---------|
| 1A | order.order_items undefined | 🔴 CRÍTICA | 140 | cancel.ts | 500 error |
| 1B | BRAND_COLORS no definida | 🔴 CRÍTICA | 1377 | email.ts | No llega email admin |
| 1C | Template string inválido | 🟠 MAYOR | 1419 | email.ts | Problemas en HTML |
| 2 | Cancelación múltiple sin idempotencia | 🟠 MAYOR | Frontend | perfil.astro | Request duplicados |
| 4A | RPC error no detiene | 🔴 CRÍTICA | 144 | cancel.ts | Stock no se restaura |
| 4B | product_sizes sin error handling | 🟠 MAYOR | 153 | cancel.ts | Stock parcial restaurado |

---

## ✅ SOLUCIONES

### FIX 1: Validar order_items

```typescript
// ANTES:
for (const item of order.order_items) {

// DESPUÉS:
if (!order.order_items || order.order_items.length === 0) {
    console.warn('⚠️ No hay items en el pedido');
    // Continuamos (puede haber un pedido sin items)
}

for (const item of order.order_items || []) {
```

---

### FIX 2: Importar BRAND_COLORS en email.ts

```typescript
// ANTES:
export async function sendCancelledOrderAdminAlert(data: CancelledOrderAlertData): Promise<boolean> {
  const ADMIN_EMAIL = 'p2590149@gmail.com';
  try {
    const html = `...${BRAND_COLORS.red}...`;

// DESPUÉS:
export async function sendCancelledOrderAdminAlert(data: CancelledOrderAlertData): Promise<boolean> {
  const ADMIN_EMAIL = 'p2590149@gmail.com';
  
  const BRAND_COLORS = {
    navy: '#1a2744',
    red: '#dc2626',
    success: '#16a34a'
  };
  
  try {
    const html = `...${BRAND_COLORS.red}...`;
```

---

### FIX 3: Quitar \n inválido en template

```typescript
// ANTES:
            ` : ''}\n
            <center>

// DESPUÉS:
            ` : ''}
            <center>
```

---

### FIX 4: Error handling en RPC

```typescript
// ANTES:
const { error: rpcError } = await adminClient.rpc('increment_stock', {
    product_id_param: item.product_id,
    quantity_param: item.quantity
});

if (rpcError) console.error('RPC Error:', rpcError);

// DESPUÉS:
const { error: rpcError } = await adminClient.rpc('increment_stock', {
    product_id_param: item.product_id,
    quantity_param: item.quantity
});

if (rpcError) {
    console.error('❌ RPC Error restaurando stock:', rpcError);
    throw new Error(`No se pudo restaurar stock del producto ${item.product_id}: ${rpcError.message}`);
}
```

---

### FIX 5: Error handling en product_sizes

```typescript
// ANTES:
if (item.size) {
    const { data: sizeStock } = await adminClient
        .from('product_sizes')
        .select('stock')
        .eq('product_id', item.product_id)
        .eq('size', item.size)
        .single();

    if (sizeStock) {
        await adminClient
            .from('product_sizes')
            .update({ stock: sizeStock.stock + item.quantity })
            .eq('product_id', item.product_id)
            .eq('size', item.size);
    }
}

// DESPUÉS:
if (item.size) {
    const { data: sizeStock, error: sizeError } = await adminClient
        .from('product_sizes')
        .select('stock')
        .eq('product_id', item.product_id)
        .eq('size', item.size)
        .single();

    if (sizeError) {
        console.error(`⚠️ No se encontró talla ${item.size} para producto ${item.product_id}`);
        continue; // Continuamos sin fallar
    }

    if (sizeStock) {
        const { error: updateError } = await adminClient
            .from('product_sizes')
            .update({ stock: sizeStock.stock + item.quantity })
            .eq('product_id', item.product_id)
            .eq('size', item.size);
            
        if (updateError) {
            console.error(`❌ Error actualizando talla ${item.size}:`, updateError);
            throw new Error(`No se pudo actualizar stock de talla ${item.size}`);
        }
    }
}
```

---

## 🔄 FLUJO CORREGIDO

```
Cliente hace click "Cancelar"
    ↓
[VALIDACIÓN] ¿Existe orderId?
    ↓
[AUTENTICACIÓN] ¿Usuario válido?
    ↓
[VALIDACIÓN] ¿Pedido es "paid"?
    ↓
[EMAIL 1] → Cliente: "Procesando..." ✓
    ↓
[STRIPE] Reembolsar ✓
    ↓
[STOCK] Restaurar stock general + tallas ✓ (CON ERROR HANDLING)
    ↓
[BD] Actualizar a "cancelled" ✓
    ↓
[EMAIL 2] → Cliente: "Cancelado" ✓
    ↓
✅ Respuesta inmediata al cliente
    ↓
⏱️ Espera 2 segundos
    ↓
[EMAIL 3] → Admin: "Cancelado" ✓ (CON BRAND_COLORS DEFINIDO)
```

---

## 🎯 ORDEN DE IMPLEMENTACIÓN

1. ✅ Importar BRAND_COLORS en email.ts (CRÍTICO)
2. ✅ Quitar \n inválido en template
3. ✅ Validar order_items en cancel.ts
4. ✅ Mejorar error handling en RPC
5. ✅ Mejorar error handling en product_sizes
6. ✅ Agregar errores detallados al catch final

---

**Listo para implementar?** ✅

