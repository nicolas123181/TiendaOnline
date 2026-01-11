import { Resend } from 'resend';

const resendApiKey = import.meta.env.RESEND_API_KEY;

// Verificar que la API key existe
if (!resendApiKey) {
  console.warn('⚠️ RESEND_API_KEY no está configurada. Los emails no se enviarán.');
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Colores de marca Vantage
const BRAND_COLORS = {
  navy: '#1a2744',
  navyLight: '#2d4a6f',
  cream: '#f8f5f0',
  gold: '#b8860b',
  white: '#ffffff',
  gray: '#6b7280',
  success: '#16a34a',
  error: '#dc2626',
  warning: '#d97706'
};

interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  shipping: number;
  discount?: number;
  total: number;
  shippingAddress: string;
  city: string;
  postalCode: string;
  phone?: string;
  baseUrl?: string;
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmationEmail(data: OrderEmailData) {
  if (!resend) {
    console.warn('⚠️ Resend no configurado, email no enviado');
    return null;
  }
  try {
    const itemsHtml = data.items
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; text-align: left;">${item.productName}</td>
          <td style="padding: 12px; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; text-align: right;">€${(item.price / 100).toFixed(2)}</td>
          <td style="padding: 12px; text-align: right; font-weight: bold;">€${((item.price * item.quantity) / 100).toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${BRAND_COLORS.navy}; color: white; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .logo { font-size: 28px; font-weight: 300; letter-spacing: 0.3em; margin-bottom: 10px; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .order-number { font-size: 20px; font-weight: bold; margin: 10px 0; opacity: 0.9; }
            .section { margin: 30px 0; }
            .section-title { font-size: 14px; font-weight: bold; color: ${BRAND_COLORS.navy}; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 2px solid ${BRAND_COLORS.navy}; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .summary { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .summary-row { display: flex; justify-content: space-between; padding: 8px 0; }
            .summary-row.total { font-size: 18px; font-weight: bold; color: ${BRAND_COLORS.navy}; border-top: 2px solid #eee; padding-top: 15px; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
            .button { background: ${BRAND_COLORS.navy}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; font-weight: 500; letter-spacing: 0.05em; }
            .address-box { background: white; padding: 15px; border-left: 4px solid ${BRAND_COLORS.navy}; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">VANTAGE</div>
              <h1 style="margin: 0; font-weight: 400;">¡Pedido Confirmado!</h1>
              <div class="order-number">Pedido #${data.orderNumber}</div>
            </div>

            <div class="content">
              <p>Hola <strong>${data.customerName}</strong>,</p>
              <p>Gracias por tu compra. Tu pedido ha sido confirmado y está siendo procesado.</p>

              <!-- Order Items -->
              <div class="section">
                <div class="section-title">Resumen del Pedido</div>
                <table>
                  <thead>
                    <tr style="background: #f5f5f5;">
                      <th style="padding: 12px; text-align: left;">Producto</th>
                      <th style="padding: 12px; text-align: center;">Cantidad</th>
                      <th style="padding: 12px; text-align: right;">Precio Unitario</th>
                      <th style="padding: 12px; text-align: right;">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>
              </div>

              <!-- Price Summary -->
              <div class="summary">
                <div class="summary-row">
                  <span>Subtotal:</span>
                  <span>€${(data.subtotal / 100).toFixed(2)}</span>
                </div>
                <div class="summary-row">
                  <span>Envío:</span>
                  <span>€${(data.shipping / 100).toFixed(2)}</span>
                </div>
                ${data.discount ? `
                <div class="summary-row" style="color: #28a745;">
                  <span>Descuento:</span>
                  <span>-€${(data.discount / 100).toFixed(2)}</span>
                </div>
                ` : ''}
                <div class="summary-row total">
                  <span>Total:</span>
                  <span>€${(data.total / 100).toFixed(2)}</span>
                </div>
              </div>

              <!-- Shipping Address -->
              <div class="section">
                <div class="section-title">Dirección de Envío</div>
                <div class="address-box">
                  <p>${data.shippingAddress}</p>
                  <p>${data.postalCode} ${data.city}</p>
                  ${data.phone ? `<p>Teléfono: ${data.phone}</p>` : ''}
                </div>
              </div>

              <!-- Next Steps -->
              <div class="section">
                <div class="section-title">Próximos Pasos</div>
                <p>Recibirás un email con el número de seguimiento cuando tu pedido sea enviado.</p>
                <p>Puedes ver el estado de tu pedido en tu perfil con el número <strong>#${data.orderNumber}</strong>.</p>
              </div>

              <center>
                <a href="${data.baseUrl || 'https://vantage.com'}/perfil" class="button">Ver Mis Pedidos</a>
              </center>

              <div class="footer">
                <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                <p>© 2026 Vantage. Todos los derechos reservados.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = await resend!.emails.send({
      from: 'Vantage <onboarding@resend.dev>',
      to: data.customerEmail,
      subject: `¡Pedido Confirmado! #${data.orderNumber}`,
      html,
    });

    console.log('Email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Send shipping notification email
 */
export async function sendShippingNotificationEmail(data: {
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
}) {
  if (!resend) {
    console.warn('⚠️ Resend no configurado, shipping notification no enviado');
    return null;
  }
  try {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${BRAND_COLORS.navy}; color: white; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .logo { font-size: 28px; font-weight: 300; letter-spacing: 0.3em; margin-bottom: 10px; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${BRAND_COLORS.success}; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
            .button { background: ${BRAND_COLORS.navy}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">VANTAGE</div>
              <h1 style="margin: 0; font-weight: 400;">¡Tu Pedido ha sido Enviado!</h1>
            </div>

            <div class="content">
              <p>Hola <strong>${data.customerName}</strong>,</p>
              <p>¡Buenas noticias! Tu pedido está en camino.</p>

              <div class="info-box">
                <p><strong>Número de Pedido:</strong> #${data.orderNumber}</p>
                ${data.trackingNumber ? `<p><strong>Número de Seguimiento:</strong> ${data.trackingNumber}</p>` : ''}
                ${data.estimatedDelivery ? `<p><strong>Entrega Estimada:</strong> ${data.estimatedDelivery}</p>` : ''}
              </div>

              <p>Puedes rastrear tu pedido usando el número de seguimiento arriba.</p>

              <center>
                <a href="https://vantage.com/pedido/${data.orderNumber}" class="button">Rastrear Pedido</a>
              </center>

              <div class="footer">
                <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                <p>© 2026 Vantage. Todos los derechos reservados.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = await resend!.emails.send({
      from: 'Vantage <onboarding@resend.dev>',
      to: data.customerEmail,
      subject: `¡Tu pedido ha sido enviado! #${data.orderNumber}`,
      html,
    });

    console.log('Shipping notification sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending shipping notification:', error);
    throw error;
  }
}

/**
 * Send delivery confirmation email
 */
export async function sendDeliveryConfirmationEmail(data: {
  customerName: string;
  customerEmail: string;
  orderNumber: string;
}) {
  if (!resend) {
    console.warn('⚠️ Resend no configurado, delivery confirmation no enviado');
    return null;
  }
  try {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${BRAND_COLORS.success}; color: white; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .logo { font-size: 28px; font-weight: 300; letter-spacing: 0.3em; margin-bottom: 10px; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .success-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
            .button { background: ${BRAND_COLORS.navy}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">VANTAGE</div>
              <h1 style="margin: 0; font-weight: 400;">✓ ¡Pedido Entregado!</h1>
            </div>

            <div class="content">
              <p>Hola <strong>${data.customerName}</strong>,</p>
              
              <div class="success-box">
                <h2 style="color: ${BRAND_COLORS.success};">Tu pedido ha sido entregado exitosamente</h2>
                <p><strong>Número de Pedido:</strong> #${data.orderNumber}</p>
              </div>

              <p>Esperamos que disfrutes tu compra. Si tienes algún problema o pregunta, por favor no dudes en contactarnos.</p>

              <p>¡Gracias por comprar en Vantage!</p>

              <div class="footer">
                <p>© 2026 Vantage. Todos los derechos reservados.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = await resend!.emails.send({
      from: 'Vantage <onboarding@resend.dev>',
      to: data.customerEmail,
      subject: `Pedido entregado: #${data.orderNumber}`,
      html,
    });

    console.log('Delivery confirmation sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending delivery confirmation:', error);
    throw error;
  }
}

// =====================================================
// NEW ORDER ADMIN NOTIFICATION
// =====================================================

interface NewOrderAlertData {
  orderId: number;
  customerName: string;
  customerEmail: string;
  total: number;
  itemCount: number;
  shippingMethod?: string;
}

/**
 * Envía una notificación al administrador cuando hay un nuevo pedido
 */
export async function sendNewOrderAdminAlert(data: NewOrderAlertData): Promise<boolean> {
  if (!resend) {
    console.warn('⚠️ Resend no configurado, alerta de nuevo pedido no enviada');
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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f0fdf4; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: ${BRAND_COLORS.success}; color: white; padding: 40px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 400; }
        .header .icon { font-size: 60px; margin-bottom: 15px; }
        .logo { font-size: 20px; font-weight: 300; letter-spacing: 0.3em; margin-bottom: 15px; opacity: 0.9; }
        .content { padding: 40px; }
        .order-box { background: #f0fdf4; border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0; border: 2px solid ${BRAND_COLORS.success}; }
        .order-number { font-size: 36px; font-weight: bold; color: ${BRAND_COLORS.success}; }
        .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
        .info-row:last-child { border-bottom: none; }
        .label { color: #6b7280; }
        .value { font-weight: bold; color: #111827; }
        .button { display: inline-block; background: ${BRAND_COLORS.navy}; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
        .footer { text-align: center; padding: 30px; background: #f9fafb; color: #6b7280; font-size: 14px; }
        .urgency { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="logo">VANTAGE</div>
            <div class="icon">🎉</div>
            <h1>¡Nuevo Pedido!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Corre a prepararlo para entregarlo</p>
          </div>
          <div class="content">
            <div class="order-box">
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Número de pedido</p>
              <div class="order-number">#${data.orderId.toString().padStart(5, '0')}</div>
            </div>
            
            <div class="urgency">
              <strong>⚡ ¡Acción requerida!</strong>
              <p style="margin: 10px 0 0 0; color: #92400e;">Este pedido está pagado y esperando a ser preparado.</p>
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
                <span class="label">Productos</span>
                <span class="value">${data.itemCount} artículo(s)</span>
              </div>
              ${data.shippingMethod ? `
              <div class="info-row">
                <span class="label">Envío</span>
                <span class="value">${data.shippingMethod}</span>
              </div>
              ` : ''}
              <div class="info-row">
                <span class="label">Total</span>
                <span class="value" style="color: ${BRAND_COLORS.success}; font-size: 20px;">€${(data.total / 100).toFixed(2)}</span>
              </div>
            </div>

            <center>
              <a href="https://vantage.com/admin/pedidos" class="button">Ver Pedido en Admin</a>
            </center>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático de Vantage</p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    const result = await resend.emails.send({
      from: 'Vantage <onboarding@resend.dev>',
      to: ADMIN_EMAIL,
      subject: `🎉 ¡Nuevo Pedido #${data.orderId.toString().padStart(5, '0')}! - €${(data.total / 100).toFixed(2)}`,
      html,
    });

    console.log('✅ New order admin alert sent:', result);
    return true;
  } catch (error) {
    console.error('❌ Error sending new order admin alert:', error);
    return false;
  }
}

// =====================================================
// LOW STOCK ALERT EMAIL
// =====================================================

// Umbral de stock bajo
export const LOW_STOCK_THRESHOLD = 5;

// Email del administrador para alertas
const ADMIN_ALERT_EMAIL = 'p2590149@gmail.com';

export interface LowStockProduct {
  id: number;
  name: string;
  stock: number;
  slug?: string;
}

/**
 * Envía una alerta de stock bajo por email al administrador
 */
export async function sendLowStockAlert(products: LowStockProduct[]): Promise<boolean> {
  if (products.length === 0) {
    return true;
  }

  if (!resend) {
    console.warn('⚠️ Resend no configurado, alerta de stock bajo no enviada');
    console.log('Productos con stock bajo:', products);
    return false;
  }

  try {
    const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';

    const productsListHtml = products
      .map(p => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; text-align: left;">${p.name}</td>
          <td style="padding: 12px; text-align: center;">
            <span style="background-color: ${p.stock === 0 ? '#fee2e2' : '#fef3c7'}; color: ${p.stock === 0 ? '#dc2626' : '#d97706'}; padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 12px;">
              ${p.stock} ${p.stock === 0 ? '(AGOTADO)' : 'uds'}
            </span>
          </td>
          <td style="padding: 12px; text-align: center;">
            <a href="${siteUrl}/admin/productos/${p.id}" style="color: ${BRAND_COLORS.navy}; text-decoration: underline; font-size: 13px;">Gestionar</a>
          </td>
        </tr>
      `)
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9fafb; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${BRAND_COLORS.navy}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .logo { font-size: 20px; font-weight: 300; letter-spacing: 0.3em; margin-bottom: 10px; opacity: 0.9; }
            .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .alert-box { background: #fef3c7; border-left: 4px solid #d97706; padding: 16px; border-radius: 4px; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #374151; }
            .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
            .button { background: ${BRAND_COLORS.navy}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">VANTAGE</div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 400;">⚠️ Alerta de Stock Bajo</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">Sistema de Inventario</p>
            </div>

            <div class="content">
              <div class="alert-box">
                <p style="margin: 0; color: #92400e; font-weight: 600;">
                  ${products.length} producto${products.length > 1 ? 's' : ''} con stock bajo detectado${products.length > 1 ? 's' : ''}
                </p>
                <p style="margin: 8px 0 0 0; color: #a16207; font-size: 14px;">
                  Stock igual o inferior a ${LOW_STOCK_THRESHOLD} unidades
                </p>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style="text-align: center;">Stock</th>
                    <th style="text-align: center;">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${productsListHtml}
                </tbody>
              </table>

              <center>
                <a href="${siteUrl}/admin/productos" class="button">Ir al Panel de Productos</a>
              </center>

              <div class="footer">
                <p>Este es un mensaje automático de Vantage.</p>
                <p>Por favor, repón stock de los productos afectados para evitar pérdidas de ventas.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = await resend!.emails.send({
      from: 'Vantage <onboarding@resend.dev>',
      to: ADMIN_ALERT_EMAIL,
      subject: `⚠️ Alerta de Stock Bajo - Vantage (${products.length} producto${products.length > 1 ? 's' : ''})`,
      html,
    });

    console.log(`Low stock alert sent for ${products.length} products:`, result);
    return true;
  } catch (error) {
    console.error('Error sending low stock alert:', error);
    return false;
  }
}

// =====================================================
// OUT OF STOCK ALERT EMAIL (PRODUCTO AGOTADO)
// =====================================================

export interface OutOfStockProduct {
  id: number;
  name: string;
  slug?: string;
}

/**
 * Envía una alerta de producto agotado por email al administrador
 */
export async function sendOutOfStockAlert(products: OutOfStockProduct[]): Promise<boolean> {
  if (products.length === 0) {
    return true;
  }

  if (!resend) {
    console.warn('⚠️ Resend no configurado, alerta de productos agotados no enviada');
    console.log('Productos agotados:', products);
    return false;
  }

  try {
    const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';

    const productsListHtml = products
      .map(p => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; text-align: left; font-weight: 600;">${p.name}</td>
          <td style="padding: 12px; text-align: center;">
            <span style="background-color: #fee2e2; color: #dc2626; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 12px;">
              AGOTADO
            </span>
          </td>
          <td style="padding: 12px; text-align: center;">
            <a href="${siteUrl}/admin/productos/${p.id}" style="color: ${BRAND_COLORS.navy}; text-decoration: underline; font-size: 13px;">Reponer Stock</a>
          </td>
        </tr>
      `)
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9fafb; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .logo { font-size: 20px; font-weight: 300; letter-spacing: 0.3em; margin-bottom: 10px; opacity: 0.9; }
            .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .alert-box { background: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 4px; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #374151; }
            .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
            .button { background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">VANTAGE</div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 400;">🚨 ¡Productos Agotados!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">Alerta Crítica de Inventario</p>
            </div>

            <div class="content">
              <div class="alert-box">
                <p style="margin: 0; color: #991b1b; font-weight: 600;">
                  ¡URGENTE! ${products.length} producto${products.length > 1 ? 's se han' : ' se ha'} quedado sin stock
                </p>
                <p style="margin: 8px 0 0 0; color: #b91c1c; font-size: 14px;">
                  Los clientes no pueden comprar estos productos hasta que repongas el inventario.
                </p>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style="text-align: center;">Estado</th>
                    <th style="text-align: center;">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${productsListHtml}
                </tbody>
              </table>

              <center>
                <a href="${siteUrl}/admin/productos" class="button">Gestionar Inventario Ahora</a>
              </center>

              <div class="footer">
                <p>Este es un mensaje automático de Vantage.</p>
                <p>⚡ Repón stock lo antes posible para no perder ventas.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = await resend!.emails.send({
      from: 'Vantage <onboarding@resend.dev>',
      to: ADMIN_ALERT_EMAIL,
      subject: `🚨 URGENTE: ${products.length} Producto${products.length > 1 ? 's' : ''} Agotado${products.length > 1 ? 's' : ''} - Vantage`,
      html,
    });

    console.log(`Out of stock alert sent for ${products.length} products:`, result);
    return true;
  } catch (error) {
    console.error('Error sending out of stock alert:', error);
    return false;
  }
}
