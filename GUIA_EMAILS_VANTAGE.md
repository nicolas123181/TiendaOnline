# 📧 Guía Maestra de Emails - VANTAGE

Esta guía documenta exhaustivamente todos los flujos de correo electrónico del sistema Vantage, detallando disparadores, destinatarios y contenido. Diseñada para verificar la entrega y calidad de cada comunicación.

---

## 🛍️ 1. Ciclo de Vida del Pedido (Cliente)

Estos emails mantienen al cliente informado durante todo el proceso de compra "hacia adelante".

### 1.1. Confirmación de Pedido
*   **Disparador**: Inmediatamente después de un pago exitoso en Stripe (`/api/confirm-payment`).
*   **Destinatario**: Cliente.
*   **Contenido Clave**:
    *   ✅ "¡Pedido Confirmado!" con número de orden.
    *   📸 Tabla visual de productos (imágenes 70x70px).
    *   💶 Desglose financiero (Subtotal, Envío, Descuento, Total).
    *   📍 Dirección de envío.
    *   📄 **Enlace directo a Factura PDF** (destacado en caja azul).

### 1.2. Pedido Enviado (con Tracking)
*   **Disparador**: Admin marca el pedido como `shipped` (`Enviado`) desde el panel.
*   **Destinatario**: Cliente.
*   **Contenido Clave**:
    *   📦 "¡Tu pedido va en camino!"
    *   🚚 Nombre del transportista y Número de Seguimiento.
    *   🔍 Botón "Rastrear mi Pedido" (enlace dinámico).
    *   💡 Consejo de guardar el número.

### 1.3. Listo para Recoger (Click & Collect)
*   **Disparador**: Admin marca el pedido como `ready_for_pickup` (`Listo para recoger`).
*   **Destinatario**: Cliente.
*   **Contenido Clave**:
    *   🎉 "¡Tu pedido está listo!"
    *   🏪 Instrucciones de recogida en tienda (traer DNI).
    *   📍 Dirección de la tienda.

### 1.4. Pedido Entregado
*   **Disparador**: Admin marca el pedido como `delivered` (`Entregado`).
*   **Destinatario**: Cliente.
*   **Contenido Clave**:
    *   ✅ "¡Entrega completada!"
    *   ⭐ Invitación a dejar una reseña ("¿Te ha gustado tu experiencia?").
    *   🛍️ Botón "Seguir Comprando".

---

## 🔄 2. Post-Venta Inversa (Devoluciones)

Flujo completo de devoluciones automatizadas (`/api/returns/create-return` y `/api/admin/update-return`).

### 2.1. Solicitud de Devolución + Etiqueta
*   **Disparador**: Cliente solicita devolución desde su perfil.
*   **Destinatario**: Cliente.
*   **Contenido Clave**:
    *   📦 "Tu Devolución Está en Marcha".
    *   📎 **ADJUNTO: PDF con Etiqueta de Envío** (generada con `pdfkit` y código de barras).
    *   📋 Instrucciones paso a paso (Imprimir, Pegar, Llevar a Correos).
    *   🔢 Número de devolución (`RET-XXXXX`).

### 2.2. Paquete Recibido en Almacén
*   **Disparador**: Admin marca devolución como `received` (Recibido).
*   **Destinatario**: Cliente.
*   **Contenido Clave**:
    *   📦 "¡Hemos recibido tu paquete!".
    *   🔍 Timeline visual mostrando estado "En Revisión".
    *   ⏱️ Aviso de plazo de revisión (2-4 días).

### 2.3. Reembolso Procesado (Éxito)
*   **Disparador**: Admin aprueba el reembolso (`refunded`). Se integra con Stripe para devolver el dinero real.
*   **Destinatario**: Cliente.
*   **Contenido Clave**:
    *   🎉 "¡Devolución Completada!".
    *   💰 Importe exacto reembolsado destacado en verde.
    *   timeline visual con todos los pasos completados.
    *   💳 Aviso de tiempo bancario (3-5 días).

### 2.4. Devolución Rechazada
*   **Disparador**: Admin rechaza la devolución (`rejected`).
*   **Destinatario**: Cliente.
*   **Contenido Clave**:
    *   🛑 "Actualización de tu devolución".
    *   📝 Motivo del rechazo (escrito por el admin).
    *   📞 Invitación a contactar soporte.

---

## 🛡️ 3. Alertas Administrativas (Operaciones)

Emails críticos para la gestión del negocio en tiempo real.

### 3.1. Nuevo Pedido Recibido
*   **Disparador**: Inmediatamente tras una venta.
*   **Destinatario**: Administrador (`p2590149@gmail.com`).
*   **Contenido Clave**:
    *   🎉 "¡Nuevo Pedido! Corre a prepararlo".
    *   💰 Valor total y lista de items.
    *   ⚡ Banner "Acción requerida".
    *   🔘 Enlace al panel de admin.

### 3.2. Nueva Devolución Solicitada
*   **Disparador**: Cliente crea una solicitud de devolución.
*   **Destinatario**: Administrador.
*   **Contenido Clave**:
    *   🔄 "Nueva Devolución RET-XXXX".
    *   📝 Motivo y productos.
    *   ℹ️ Aviso de que el cliente ya tiene su etiqueta.

### 3.3. Alerta de Stock Bajo
*   **Disparador**: Tras venta, stock < 5 unidades.
*   **Destinatario**: Administrador.
*   **Contenido Clave**:
    *   ⚠️ Lista de productos y stock restante.
    *   🔘 Botón "Gestionar Productos".

### 3.4. Alerta de Stock Agotado (Crítico)
*   **Disparador**: Stock llega a 0.
*   **Destinatario**: Administrador.
*   **Contenido Clave**:
    *   🚨 Banner Rojo "¡URGENTE!".
    *   ⛔ Productos agotados y pérdida de ventas potencial.

---

## ❤️ 4. Engagement & Marketing (Wishlist)

Emails de retargeting automático.

### 4.1. Alerta "Tu Favorito se Agota"
*   **Disparador**: Cron Job (`/api/admin/wishlist-notifications`) detecta stock < 9 en wishlist.
*   **Destinatario**: Usuarios interesados.
*   **Contenido Clave**:
    *   ⏰ "¡Últimas unidades!".
    *   📸 Foto del producto en su talla.
    *   🔘 Botón "Comprar Ahora".

### 4.2. Alerta "Tu Favorito en Oferta"
*   **Disparador**: Detección de bajada de precio.
*   **Destinatario**: Usuarios interesados.
*   **Contenido Clave**:
    *   🏷️ "¡Tu favorito está en oferta!".
    *   💰 Porcentaje de descuento (ej: "-20%").
    *    Banner "Oferta por tiempo limitado".

---

## 📢 5. Comunicaciones Masivas

### 5.1. Newsletter Manual
*   **Disparador**: Envío desde Panel Admin.
*   **Destinatario**: Suscriptores activos.
*   **Contenido**: Personalizable + enlace de baja automático.

---

## 🔐 6. Autenticación (Sistema)

### 6.1. Recuperación de Contraseña
*   **Disparador**: Solicitud en `/recuperar-contrasena`.
*   **Destinatario**: Usuario.
*   **Sistema**: Gestionado por Supabase Auth (Template configurable en Supabase Dashboard).

---

## 🎨 Notas de Diseño (Brand Identity)

Todos los emails comparten el sistema de diseño "Vantage Premium":
*   **Tipografía**: System fonts (San Francisco/Inter).
*   **Paleta**: Navy (`#1a2744`) y Gold (`#b8860b`).
*   **Layout**: Tarjeta central blanca sobre fondo crema (`#f8f5f0`).
*   **Mobile First**: Responsivos 100%.

Documento actualizado: 2026-01-19 (Incluye flujo completo de devoluciones).
