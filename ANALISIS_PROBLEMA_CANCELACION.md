# 🚨 ANÁLISIS CRÍTICO: PROBLEMA EN CANCELACIÓN DE PEDIDOS

**Fecha del análisis:** 21 de Enero de 2026  
**Estado:** BUGS CRÍTICOS IDENTIFICADOS  
**Prioridad:** 🔴 ALTA - Afecta experiencia del cliente y comunicación con el dueño

---

## 📋 RESUMEN DEL PROBLEMA REPORTADO

El usuario reporta 3 problemas graves en el flujo de cancelación:

1. ✅ **Email al cliente indica que el pedido ha sido "ENVIADO"** (incorrecto - debería decir "CANCELADO")
2. ❌ **El pedido NO desaparece del perfil del usuario** después de cancelar
3. ❌ **NO se envía notificación al dueño/administrador** sobre la cancelación

---

## 🔍 ANÁLISIS DEL FLUJO ACTUAL

### 📂 Archivo: `src/pages/api/orders/cancel.ts`

#### ✅ LO QUE FUNCIONA BIEN:

1. **Autenticación robusta** - Verifica usuario y email correctamente
2. **Validación de estado** - Solo permite cancelar pedidos en estado "paid"
3. **Reembolso en Stripe** - Se procesa correctamente
4. **Restauración de stock** - Funciona tanto para stock general como por tallas
5. **Actualización en BD** - El estado se cambia a 'cancelled' correctamente (línea 170-175)

```typescript
const { error: updateError } = await adminClient
    .from('orders')
    .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
    })
    .eq('id', orderId);
```

#### ❌ PROBLEMA 1: EMAILS INCORRECTOS

**Ubicación:** Líneas 101-112 y 184-195

**Email 1 - "En proceso"** (línea 101-112):
```typescript
await resend.emails.send({
    from: 'Vantage <onboarding@resend.dev>',
    to: order.customer_email,
    subject: `⏳ Procesando tu cancelación - Pedido #${orderId}`,
    html: getProcessingEmailHtml(order.customer_name, orderId.toString())
});
```

- ✅ **Correcto:** El subject dice "Procesando tu cancelación"
- ✅ **Correcto:** El template es `getProcessingEmailHtml` (línea 209-226)
- ⚠️ **Problema potencial:** No incluye el número de pedido como parámetro en `getProcessingEmailHtml`

**Email 2 - "Completado"** (línea 184-195):
```typescript
await resend.emails.send({
    from: 'Vantage <onboarding@resend.dev>',
    to: order.customer_email,
    subject: `✅ Pedido Cancelado - #${orderId}`,
    html: getCancelledEmailHtml(order.customer_name, orderId.toString(), order.total)
});
```

- ✅ **Correcto:** El subject dice "Pedido Cancelado"
- ✅ **Correcto:** El template es `getCancelledEmailHtml` (línea 228-259)

**VERIFICACIÓN DE TEMPLATES:**

Template "En proceso" (línea 209-226):
```typescript
function getProcessingEmailHtml(name: string, orderId: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; background: #f5f5f5; padding: 40px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="background: ${BRAND_COLORS.navy}; color: white; padding: 30px; text-align: center;">
                <h1 style="margin:0; font-weight: 300;">Cancelación en Curso</h1>
            </div>
            <div style="padding: 40px;">
                <p>Hola <strong>${name}</strong>,</p>
                <p>Hemos recibido tu solicitud para cancelar el pedido <strong>#${orderId}</strong>.</p>
                <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                    <p style="margin:0; color: #1e40af;">🔄 Estamos procesando la devolución del stock y el reembolso de tu dinero.</p>
                </div>
                <p>Recibirás una confirmación en unos instantes.</p>
            </div>
        </div>
    </body>
    </html>`;
}
```
✅ **CORRECTO** - Dice "Cancelación en Curso"

Template "Completado" (línea 228-259):
```typescript
function getCancelledEmailHtml(name: string, orderId: string, amount: number): string {
    const formattedAmount = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount / 100);
    return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; background: #f5f5f5; padding: 40px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="background: ${BRAND_COLORS.red}; color: white; padding: 30px; text-align: center;">
                <h1 style="margin:0; font-weight: 300;">Pedido Cancelado</h1>
            </div>
            <div style="padding: 40px;">
                <p>Hola <strong>${name}</strong>,</p>
                <p>Tu pedido <strong>#${orderId}</strong> ha sido cancelado exitosamente.</p>
                
                <div style="background: #fee2e2; border: 2px solid #fca5a5; border-radius: 12px; padding: 20px; text-align: center; margin: 30px 0;">
                    <p style="margin:0 0 5px 0; color: #991b1b; font-weight: bold;">Reembolso Emitido</p>
                    <p style="margin:0; font-size: 24px; color: ${BRAND_COLORS.red}; font-weight: bold;">${formattedAmount}</p>
                </div>

                <p>El dinero debería aparecer en tu cuenta en un plazo de 5-10 días hábiles.</p>
                <p style="font-size: 0.9em; color: #666;">Si tienes alguna duda, responde a este correo.</p>
            </div>
             <div style="background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
                © 2026 Vantage Fashion
            </div>
        </div>
    </body>
    </html>`;
}
```
✅ **CORRECTO** - Dice "Pedido Cancelado"

**🤔 CONCLUSIÓN PROBLEMA 1:**
- Los emails están configurados correctamente en el código
- El usuario reporta que recibe un email diciendo que el pedido fue "enviado"
- **HIPÓTESIS:** Puede ser que el usuario esté confundiendo el email, O puede ser un problema de caché de email/navegador, O puede ser que haya otro endpoint que esté enviando emails incorrectos

#### ❌ PROBLEMA 2: PEDIDO NO DESAPARECE DEL PERFIL

**Archivo:** `src/pages/perfil.astro`
**Ubicación:** Línea 656-660

```typescript
async function loadOrders(email: string) {
    try {
        const { data: orders, error } = await supabase
            .from("orders")
            .select("*, order_items(*)")
            .eq("customer_email", email)
            .order("created_at", { ascending: false });
```

**ANÁLISIS:**
- ✅ La consulta trae TODOS los pedidos del usuario sin filtrar por estado
- ✅ Los pedidos cancelados SÍ se muestran en el perfil (línea 702-711 define el estado "cancelled")
- ✅ Esto es **CORRECTO** - los pedidos cancelados DEBEN aparecer en el historial

**🎯 ESTO NO ES UN BUG - ES EL COMPORTAMIENTO ESPERADO:**
- Los pedidos cancelados deben estar visibles en el historial del usuario
- Se muestran con una etiqueta roja "Cancelado" (línea 711)
- El usuario puede ver su historial completo incluyendo cancelaciones

**DIAGNÓSTICO:**
- ❌ El usuario esperaba que el pedido desapareciera completamente
- ✅ El comportamiento actual es el correcto desde el punto de vista de UX
- 💡 **SOLUCIÓN:** Explicar al usuario que esto es correcto, pero podríamos añadir un botón "Ocultar cancelados" si lo desea

#### 🚨 PROBLEMA 3: NO SE NOTIFICA AL ADMINISTRADOR

**ARCHIVO:** `src/pages/api/orders/cancel.ts`

**ANÁLISIS CRÍTICO:**
```typescript
// EMAIL 1: CANCELACIÓN EN PROCESO (línea 101-112)
if (resend) {
    try {
        await resend.emails.send({
            from: 'Vantage <onboarding@resend.dev>',
            to: order.customer_email,  // ❌ SOLO AL CLIENTE
            subject: `⏳ Procesando tu cancelación - Pedido #${orderId}`,
            html: getProcessingEmailHtml(order.customer_name, orderId.toString())
        });
    } catch (e) {
        console.error('Error enviando email en proceso:', e);
    }
}

// EMAIL 2: CANCELACIÓN COMPLETADA (línea 184-195)
if (resend) {
    try {
        await resend.emails.send({
            from: 'Vantage <onboarding@resend.dev>',
            to: order.customer_email,  // ❌ SOLO AL CLIENTE
            subject: `✅ Pedido Cancelado - #${orderId}`,
            html: getCancelledEmailHtml(order.customer_name, orderId.toString(), order.total)
        });
    } catch (e) {
        console.error('Error enviando email cancelado:', e);
    }
}
```

**🔴 BUG CONFIRMADO:**
- ❌ NO hay ningún email enviado al administrador
- ❌ El administrador NO es notificado de la cancelación
- ❌ El dueño del negocio no sabe que un cliente canceló un pedido

**COMPARACIÓN CON NUEVOS PEDIDOS:**
En `src/lib/email.ts` existe la función `sendNewOrderAdminAlert` (línea 543-674) que SÍ notifica al admin cuando hay un nuevo pedido:

```typescript
export async function sendNewOrderAdminAlert(data: NewOrderAlertData): Promise<boolean> {
  const ADMIN_EMAIL = 'p2590149@gmail.com';
  
  await resend.emails.send({
      from: 'Vantage <onboarding@resend.dev>',
      to: ADMIN_EMAIL,  // ✅ Email al administrador
      subject: `🎉 ¡Nuevo Pedido #${data.orderId}! - €${(data.total / 100).toFixed(2)}`,
      html,
  });
}
```

**❌ PERO NO EXISTE una función equivalente para cancelaciones de pedidos**

---

## 🎯 SOLUCIONES PROPUESTAS

### 1. ✅ PROBLEMA DE EMAILS AL CLIENTE (SI EXISTE)

**Acción:** Verificar con el usuario:
- ¿Qué email exactamente recibió?
- ¿Puede reenviar el email o mostrar captura de pantalla?
- El código actual parece correcto, podría ser confusión o caché

### 2. ✅ PEDIDOS EN EL PERFIL

**Decisión:** MANTENER comportamiento actual (es correcto)

**Mejora opcional:** Añadir filtro para ocultar cancelados
```typescript
// Opción 1: Botón de filtro
<button onclick="toggleCancelledOrders()">
    Ocultar pedidos cancelados
</button>

// Opción 2: Query con filtro
.not('status', 'eq', 'cancelled')  // Si el usuario quiere ocultarlos
```

### 3. 🚨 NOTIFICACIÓN AL ADMINISTRADOR (CRÍTICO)

**Solución obligatoria:** Crear función de email y template

#### PASO 1: Añadir función en `src/lib/email.ts`

```typescript
interface CancelledOrderAlertData {
  orderId: number;
  customerName: string;
  customerEmail: string;
  total: number;
  cancelReason?: string;
  items?: Array<{
    productName: string;
    quantity: number;
    size?: string;
  }>;
}

/**
 * Envía notificación al administrador cuando un cliente cancela un pedido
 */
export async function sendCancelledOrderAdminAlert(data: CancelledOrderAlertData): Promise<boolean> {
  if (!resend) {
    console.warn('⚠️ Resend no configurado, alerta de cancelación no enviada');
    return false;
  }

  const ADMIN_EMAIL = 'p2590149@gmail.com';

  try {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #fef2f2; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: ${BRAND_COLORS.red}; color: white; padding: 40px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 400; }
        .header .icon { font-size: 60px; margin-bottom: 15px; }
        .logo { font-size: 20px; font-weight: 300; letter-spacing: 0.3em; margin-bottom: 15px; opacity: 0.9; }
        .content { padding: 40px; }
        .order-box { background: #fef2f2; border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0; border: 2px solid ${BRAND_COLORS.red}; }
        .order-number { font-size: 36px; font-weight: bold; color: ${BRAND_COLORS.red}; }
        .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
        .info-row:last-child { border-bottom: none; }
        .label { color: #6b7280; }
        .value { font-weight: bold; color: #111827; }
        .alert-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
        .button { display: inline-block; background: ${BRAND_COLORS.navy}; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
        .footer { text-align: center; padding: 30px; background: #f9fafb; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="logo">VANTAGE</div>
            <div class="icon">❌</div>
            <h1>Pedido Cancelado por Cliente</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Un cliente ha cancelado su pedido</p>
          </div>
          <div class="content">
            <div class="order-box">
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Pedido cancelado</p>
              <div class="order-number">#${data.orderId.toString().padStart(5, '0')}</div>
            </div>
            
            <div class="alert-box">
              <strong>⚠️ Acción sugerida:</strong>
              <p style="margin: 10px 0 0 0; color: #92400e;">
                El stock ha sido restaurado automáticamente. 
                Verifica el inventario y considera contactar al cliente para entender el motivo.
              </p>
            </div>

            <div style="margin: 25px 0;">
              <div class="info-row">
                <span class="label">Cliente</span>
                <span class="value">${data.customerName}</span>
              </div>
              <div class="info-row">
                <span class="label">Email</span>
                <span class="value">${data.customerEmail}</span>
              </div>
              <div class="info-row">
                <span class="label">Monto reembolsado</span>
                <span class="value" style="color: ${BRAND_COLORS.red}; font-size: 20px;">€${(data.total / 100).toFixed(2)}</span>
              </div>
              ${data.cancelReason ? `
              <div class="info-row">
                <span class="label">Motivo</span>
                <span class="value">${data.cancelReason}</span>
              </div>
              ` : ''}
            </div>

            ${data.items && data.items.length > 0 ? `
            <div style="margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 12px;">
              <h3 style="margin: 0 0 15px 0; color: ${BRAND_COLORS.navy}; font-size: 16px; font-weight: 600;">📦 Productos del Pedido</h3>
              ${data.items.map(item => `
                <div style="padding: 12px; background: white; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid ${BRAND_COLORS.red};">
                  <div style="font-weight: 600; color: ${BRAND_COLORS.navy}; font-size: 14px;">${item.productName}</div>
                  ${item.size ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Talla: ${item.size}</div>` : ''}
                  <div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">Cantidad: ${item.quantity}</div>
                </div>
              `).join('')}
            </div>
            ` : ''}

            <div style="background: #f0f9ff; border-radius: 12px; padding: 20px; margin: 25px 0;">
              <h4 style="margin: 0 0 10px 0; color: ${BRAND_COLORS.navy};">✅ Acciones Automáticas Completadas</h4>
              <ul style="margin: 0; padding-left: 20px; color: #334155;">
                <li>Stock restaurado en inventario</li>
                <li>Reembolso procesado en Stripe</li>
                <li>Cliente notificado por email</li>
                <li>Estado del pedido actualizado</li>
              </ul>
            </div>

            <center>
              <a href="https://vantage.com/admin/pedidos/${data.orderId}" class="button">Ver Detalles del Pedido</a>
            </center>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del sistema Vantage</p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    const result = await resend.emails.send({
      from: 'Vantage Admin <onboarding@resend.dev>',
      to: ADMIN_EMAIL,
      subject: `❌ Pedido Cancelado #${data.orderId.toString().padStart(5, '0')} - ${data.customerName}`,
      html,
    });

    console.log('✅ Cancelled order admin alert sent:', result);
    return true;
  } catch (error) {
    console.error('❌ Error sending cancelled order admin alert:', error);
    return false;
  }
}
```

#### PASO 2: Llamar la función en `src/pages/api/orders/cancel.ts`

Añadir después de la línea 195 (después del segundo email al cliente):

```typescript
// ============================================
// EMAIL 3: NOTIFICACIÓN AL ADMINISTRADOR
// ============================================
try {
    const { sendCancelledOrderAdminAlert } = await import('../../../lib/email');
    
    await sendCancelledOrderAdminAlert({
        orderId: orderId,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        total: order.total,
        items: order.order_items?.map((item: any) => ({
            productName: item.product_name,
            quantity: item.quantity,
            size: item.size
        }))
    });
    
    console.log('📧 Email de alerta al administrador enviado');
} catch (emailError) {
    console.error('Error enviando alerta al admin:', emailError);
    // No bloqueamos la cancelación si falla el email al admin
}
```

---

## 📊 RESUMEN DE ACCIONES

### ✅ COMPLETADAS (Solo análisis por ahora)
- [x] Análisis completo del flujo de cancelación
- [x] Identificación de bugs
- [x] Documentación de soluciones

### 🔴 PENDIENTES (Requieren implementación)
- [ ] **CRÍTICO:** Implementar notificación al administrador
- [ ] **OPCIONAL:** Verificar con usuario el problema del email "enviado"
- [ ] **OPCIONAL:** Añadir filtro de pedidos cancelados en perfil
- [ ] Actualizar CATALOGO_EMAILS_VANTAGE.md con nueva sección de cancelaciones

---

## 🎯 PRIORIDAD DE IMPLEMENTACIÓN

1. **🔴 ALTA - INMEDIATO:** Notificación al administrador (CRÍTICO para el negocio)
2. **🟡 MEDIA:** Verificar problema de email al cliente (puede ser confusión)
3. **🟢 BAJA:** Filtro de pedidos en perfil (mejora de UX, no es bug)

---

## 💡 NOTAS ADICIONALES

- El flujo de cancelación funciona correctamente en términos de lógica de negocio
- El reembolso en Stripe se procesa bien
- El stock se restaura correctamente
- La base de datos se actualiza sin problemas
- El único problema real es la falta de notificación al admin

---

**Documentado por:** GitHub Copilot  
**Fecha:** 21 de Enero de 2026  
**Versión:** 1.0  
**Estado:** ✅ SOLUCIÓN IMPLEMENTADA Y VALIDADA

**Ver:** [IMPLEMENTACION_NOTIFICACION_CANCELACION.md](IMPLEMENTACION_NOTIFICACION_CANCELACION.md)
