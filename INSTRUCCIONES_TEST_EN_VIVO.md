# 🚀 INSTRUCCIONES DE VERIFICACIÓN EN VIVO

## ⏱️ Tiempo estimado: 15-20 minutos

---

## Paso 1: Verificación Técnica Rápida

### En la terminal (desde raíz del proyecto):

```bash
# Verificar que todas las correcciones están aplicadas
grep -n "const BRAND_COLORS_EMAIL" src/lib/email.ts
grep -n "if (!order.order_items" src/pages/api/orders/cancel.ts
grep -n "throw new Error.*RPC" src/pages/api/orders/cancel.ts
```

**Esperado**: 3 líneas encontradas (una en cada comando)

---

## Paso 2: Preparar Ambiente de Test

### 2.1 Crear usuario de test (si no existe)
```
1. Ir a https://tusitio.com/registro
2. Email: test@example.com
3. Contraseña: TestPassword123!
4. Completar registro
```

### 2.2 Crear pedido de test
```
1. Login con test@example.com
2. Comprar algún producto (cantidad: 2)
3. Ir a checkout
4. Usar tarjeta de Stripe TEST: 4242 4242 4242 4242
5. Completar pago
6. Anotar número de pedido (ej: #00123)
```

---

## Paso 3: Test de Cancelación (El Gran Test)

### 3.1 Iniciar Cancelación
```
1. Login en https://tusitio.com/login
2. Ir a Perfil → Mis Pedidos
3. Hacer click en pedido de test (status: "paid")
4. Clickear botón "Cancelar Pedido"
5. Confirmar en modal
```

### 3.2 Verificar Respuesta Inmediata
```
✅ El botón debe deshabilitarse
✅ Debe mostrar "Cancelando..." con spinner
✅ Después de 2-3 segundos:
   - Página recarga automáticamente
   - Pedido muestra status "cancelled"
   - No debe haber error 500
```

**Si hay error**: Abre DevTools (F12) → Console → copiar mensaje de error

---

## Paso 4: Verificar Email al Cliente

### Inbox del Cliente (test@example.com)
```
Esperar 5-10 segundos, debe haber 2 emails:

Email 1: "Cancelación en Curso"
  ✅ Tema correcto
  ✅ Contenido claro
  ✅ Logo VANTAGE visible
  ✅ Colores correctos

Email 2: "Pedido Cancelado - #00123"
  ✅ Tema correcto
  ✅ Número de pedido visible
  ✅ Monto reembolsado: €XX.XX
  ✅ Colores correctos (no texto roto)
```

**Si NO llega**: Revisar spam, esperar más tiempo

---

## Paso 5: Verificar Email al Admin

### Inbox del Admin (p2590149@gmail.com)
```
Esperar 10-15 segundos, debe haber 1 email:

Email: "Pedido Cancelado por Cliente"
  ✅ Iconografía ❌
  ✅ "Pedido cancelado" #00123
  ✅ Cliente: "Test User"
  ✅ Email: test@example.com
  ✅ Monto reembolsado: €XX.XX
  ✅ Acciones completadas:
     • ✅ Stock restaurado
     • ✅ Reembolso procesado
     • ✅ Cliente notificado
  ✅ Lista de productos con cantidades
  ✅ Link "Ver Detalles en Admin"
  ✅ Colores correctos (NO error roto)
```

**Si NO llega**: Revisar spam, verificar logs del servidor

---

## Paso 6: Verificar Stock Restaurado

### En Base de Datos / Admin

```
1. Ir a https://tusitio.com/admin/productos
2. Buscar producto que cancelaste (ej: "Camiseta Blanca")
3. Verificar stock:
   - ANTES de cancelación: X
   - DESPUÉS de cancelación: X + cantidad cancelada
   - Si compró 2 y stock era 5: debe ser 7
```

**Si NO aumentó**: Revisar logs → "Failed to increment stock"

---

## Paso 7: Verificar Protección contra Duplicados

### Protección Frontend
```
1. Ir nuevamente a Perfil → Pedido cancelado
2. Notar que botón "Cancelar" ahora está deshabilitado (grayed out)
3. Intentar cancelar otro pedido
4. Hacer click RÁPIDAMENTE 3-4 veces en "Cancelar"
   ✅ El botón debe deshabilitarse INMEDIATAMENTE
   ✅ Debe procesarse solo UNA vez
   ✅ Botón se re-habilita solo si hay error
```

---

## Paso 8: Verificar Manejo de Errores

### Simular Error (Opcional)
```
1. Desconectar internet
2. Ir a pedido en estado "paid"
3. Clickear "Cancelar Pedido"
4. Conectar internet nuevamente
5. ✅ Debe mostrar error específico (no "Error interno...")
6. ✅ Botón debe habilitarse nuevamente
7. ✅ Usuario puede reintentar
```

---

## 📋 Checklist Final

### Cancelación
- [ ] Usuario puede iniciar cancelación
- [ ] Página no muestra error 500
- [ ] Pedido cambia a "cancelled"
- [ ] Botón se desactiva durante proceso

### Emails Cliente
- [ ] Email 1 "Procesando" llega inmediatamente
- [ ] Email 2 "Cancelado" llega dentro de 2-3s
- [ ] Ambos tienen colores correctos
- [ ] Ambos tienen información completa

### Email Admin
- [ ] Llega después de ~10 segundos
- [ ] Tiene formato correcto (sin errores)
- [ ] Muestra cliente, monto, productos
- [ ] Colores y estilos correctos

### Stock
- [ ] Se restaura correctamente
- [ ] Se restaura por talla (si aplica)
- [ ] Cantidad correcta

### Errores
- [ ] Si falla, muestra error específico
- [ ] Usuario puede ver en qué falló
- [ ] Logs del servidor tienen detalles

### Protección
- [ ] Botón deshabilitado durante cancelación
- [ ] No se puede clickear múltiples veces
- [ ] Segunda cancelación del mismo pedido falla

---

## 🔧 Troubleshooting Rápido

### Problema: Error 500
```
Solución:
1. Abre DevTools (F12)
2. Copia el error específico
3. Busca en logs del servidor
4. Compara con VERIFICACION_POST_CORRECCIONES.md
```

### Problema: Email NO llega a Admin
```
Solución:
1. Revisa spam en Gmail
2. Espera 15-20 segundos
3. Verifica logs: "Error enviando alerta al admin"
4. Busca: "BRAND_COLORS_EMAIL" en código
```

### Problema: Stock NO se restaura
```
Solución:
1. Revisa producto en admin
2. Busca en logs: "Failed to increment stock"
3. Verifica que product_sizes tiene el producto
4. Revisa permisos RLS en BD
```

### Problema: Múltiples cancelaciones
```
Solución:
1. Revisar BD: pedido debe tener solo 1 refund_id
2. Si aparece 2 veces: revertir manual
3. Agregar unique constraint en BD
```

---

## 📞 Información para Debugging

### Logs Importantes a Buscar

En **Console del Navegador**:
- "Cancel parsing error" = Problema con respuesta del servidor
- "🔍 Debug Cancel" = Inicio de cancelación
- Error de fetch = Problema de conexión

En **Logs del Servidor**:
- "Cancel order error:" = Error específico
- "Error stack:" = Detalle del error
- "Email de alerta al administrador" = Email al admin enviado OK
- "Error enviando alerta al admin" = Email al admin falló

---

## ✅ Test Completado

Si todos los pasos funcionan:
```
✅ Sistema listo para producción
✅ Todos los bugs están corregidos
✅ Cancelaciones funcionan correctamente
✅ Notificaciones llegan
✅ Stock se restaura
```

---

## 🚀 Deploy Final

Una vez verificado:
```bash
# Build
npm run build

# Si todo OK:
# Deploy a producción
git add .
git commit -m "Fix: Correct order cancellation bugs (all 6)"
git push origin main
```

---

**Última actualización**: Correcciones completadas ✅
