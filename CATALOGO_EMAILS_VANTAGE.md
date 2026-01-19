# 📧 Catálogo Visual de Emails - VANTAGE

**Sistema completo de comunicaciones transaccionales y marketing**

---

## 🛍️ 1. CICLO DE VIDA DEL PEDIDO

### 1.1 Confirmación de Pedido
**Disparador:** Pago exitoso en Stripe  
**Destinatario:** Cliente

![Confirmación de Pedido](docs/email-screenshots/email_order_confirmation_1768808221002.png)

---

### 1.2 Pedido Enviado (con Tracking)
**Disparador:** Admin marca como "Enviado"  
**Destinatario:** Cliente

![Pedido Enviado](docs/email-screenshots/email_shipping_confirmation_1768808253453.png)

---

### 1.3 Listo para Recoger (Click & Collect)
**Disparador:** Admin marca como "Listo para recoger"  
**Destinatario:** Cliente

![Listo para Recoger](docs/email-screenshots/email_pickup_ready_1768808265807.png)

---

### 1.4 Pedido Entregado
**Disparador:** Admin marca como "Entregado"  
**Destinatario:** Cliente

![Pedido Entregado](docs/email-screenshots/email_delivered_preview_1768808278541.png)

---

## 🔄 2. FLUJO DE DEVOLUCIONES

### 2.1 Solicitud de Devolución + Etiqueta PDF
**Disparador:** Cliente solicita devolución  
**Destinatario:** Cliente (incluye PDF adjunto con etiqueta de envío)

![Devolución Creada](docs/email-screenshots/email_return_created_1768808306100.png)

---

### 2.2 Paquete Recibido en Almacén
**Disparador:** Admin marca devolución como "Recibido"  
**Destinatario:** Cliente

![Paquete Recibido](docs/email-screenshots/email_return_received_1768808517326.png)

---

### 2.3 Reembolso Procesado
**Disparador:** Admin aprueba reembolso (se ejecuta en Stripe automáticamente)  
**Destinatario:** Cliente

![Reembolso Procesado](docs/email-screenshots/email_refund_confirmation_1768808486064.png)

---

### 2.4 Devolución Rechazada
**Disparador:** Admin rechaza la devolución  
**Destinatario:** Cliente

![Devolución Rechazada](docs/email-screenshots/email_return_rejected_1768808497499.png)

---

## 🛡️ 3. ALERTAS ADMINISTRATIVAS

### 3.1 Nuevo Pedido Recibido
**Disparador:** Venta completada  
**Destinatario:** Administrador

![Admin: Nuevo Pedido](docs/email-screenshots/email_admin_order_notification_1768808529275.png)

---

### 3.2 Nueva Devolución Solicitada
**Disparador:** Cliente crea devolución  
**Destinatario:** Administrador

![Admin: Nueva Devolución](docs/email-screenshots/admin_return_email_1768808549024.png)

---

### 3.3 Alerta de Stock Bajo
**Disparador:** Stock cae por debajo de 5 unidades  
**Destinatario:** Administrador

![Stock Bajo](docs/email-screenshots/email_stock_low_alert_1768808560278.png)

---

### 3.4 Alerta de Stock Agotado (Crítico)
**Disparador:** Stock llega a 0  
**Destinatario:** Administrador

![Stock Agotado](docs/email-screenshots/email_stock_out_preview_1768808571942.png)

---

## ❤️ 4. MARKETING AUTOMATIZADO (WISHLIST)

### 4.1 Tu Favorito se Está Agotando
**Disparador:** Producto en wishlist con stock bajo  
**Destinatario:** Usuario con producto en favoritos

![Wishlist Agotando](docs/email-screenshots/email_wishlist_low_stock_1768808607587.png)

---

### 4.2 Tu Favorito Está en Oferta
**Disparador:** Bajada de precio en producto de wishlist  
**Destinatario:** Usuario con producto en favoritos

![Wishlist Oferta](docs/email-screenshots/email_wishlist_sale_1768808619396.png)

---

## 📢 5. COMUNICACIONES MASIVAS

### 5.1 Newsletter
**Disparador:** Envío manual desde panel admin  
**Destinatario:** Todos los suscriptores activos

![Newsletter](docs/email-screenshots/email_newsletter_preview_1768808631288.png)

---

## 📊 RESUMEN EJECUTIVO

| Categoría | Emails | Automatización |
|-----------|--------|----------------|
| Ciclo de Pedido | 4 | 100% Automático |
| Devoluciones | 4 | 100% Automático |
| Alertas Admin | 4 | 100% Automático |
| Marketing Wishlist | 2 | Cron Job |
| Newsletter | 1 | Manual |
| **TOTAL** | **15** | |

---

*Documento generado: 19 de Enero de 2026*  
*Sistema: Vantage E-commerce Platform*
