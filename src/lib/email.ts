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
    image?: string;
    size?: string;
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
  invoiceNumber?: string;
  invoiceId?: number;
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
    const siteUrl = data.baseUrl || import.meta.env.PUBLIC_SITE_URL || 'https://vantage.es';

    const itemsHtml = data.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 15px; border-bottom: 1px solid #e5e7eb;">
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="width: 80px; vertical-align: top;">
                  ${item.image ? `<img src="${item.image}" alt="${item.productName}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb;">` : '<div style="width: 70px; height: 70px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #9ca3af;">📦</div>'}
                </td>
                <td style="padding-left: 12px; vertical-align: top;">
                  <p style="margin: 0; font-weight: 600; color: ${BRAND_COLORS.navy}; font-size: 15px;">${item.productName}</p>
                  ${item.size ? `<p style="margin: 5px 0 0 0; font-size: 13px; color: #6b7280;">Talla: ${item.size}</p>` : ''}
                </td>
              </tr>
            </table>
          </td>
          <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280; vertical-align: middle;">
            ${item.quantity}
          </td>
          <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280; vertical-align: middle;">
            €${(item.price / 100).toFixed(2)}
          </td>
          <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 700; color: ${BRAND_COLORS.navy}; vertical-align: middle;">
            €${((item.price * item.quantity) / 100).toFixed(2)}
          </td>
        </tr>
      `
      )
      .join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f5f0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f5f0; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${BRAND_COLORS.navy} 0%, ${BRAND_COLORS.navyLight} 100%); padding: 45px 30px; text-align: center;">
                  <p style="font-size: 28px; font-weight: 300; letter-spacing: 0.3em; color: ${BRAND_COLORS.gold}; margin: 0 0 20px 0;">VANTAGE</p>
                  <p style="font-size: 50px; margin: 0 0 15px 0;">✅</p>
                  <h1 style="color: #ffffff; font-size: 28px; font-weight: 600; margin: 0; line-height: 1.3;">¡Pedido Confirmado!</h1>
                  <p style="color: ${BRAND_COLORS.gold}; font-size: 20px; font-weight: 600; margin: 15px 0 0 0;">Pedido #${data.orderNumber}</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="font-size: 18px; color: #374151; margin: 0 0 25px 0; line-height: 1.5;">
                    Hola <strong style="color: ${BRAND_COLORS.navy};">${data.customerName}</strong>,
                  </p>
                  
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.7; margin: 0 0 30px 0;">
                    ¡Gracias por tu compra! Tu pedido ha sido confirmado y está siendo procesado con cuidado.
                  </p>

                  <!-- Order Items -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 12px; overflow: hidden; margin-bottom: 25px;">
                    <tr>
                      <td style="padding: 20px 15px; background-color: ${BRAND_COLORS.navy}; color: white; font-weight: 600; font-size: 14px;">Producto</td>
                      <td style="padding: 20px 15px; background-color: ${BRAND_COLORS.navy}; color: white; font-weight: 600; font-size: 14px; text-align: center;">Cant.</td>
                      <td style="padding: 20px 15px; background-color: ${BRAND_COLORS.navy}; color: white; font-weight: 600; font-size: 14px; text-align: right;">Precio</td>
                      <td style="padding: 20px 15px; background-color: ${BRAND_COLORS.navy}; color: white; font-weight: 600; font-size: 14px; text-align: right;">Total</td>
                    </tr>
                    ${itemsHtml}
                  </table>

                  <!-- Price Summary -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8; border-radius: 12px; margin-bottom: 25px;">
                    <tr>
                      <td style="padding: 20px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 8px 0; color: #6b7280;">Subtotal:</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: 600;">€${(data.subtotal / 100).toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #6b7280;">Envío:</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${data.shipping === 0 ? 'GRATIS' : '€' + (data.shipping / 100).toFixed(2)}</td>
                          </tr>
                          ${data.discount ? `
                          <tr>
                            <td style="padding: 8px 0; color: #16a34a;">Descuento:</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #16a34a;">-€${(data.discount / 100).toFixed(2)}</td>
                          </tr>
                          ` : ''}
                          <tr>
                            <td colspan="2" style="padding: 15px 0 0 0; border-top: 2px solid #e5e7eb;"></td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; font-size: 18px; font-weight: 700; color: ${BRAND_COLORS.navy};">Total:</td>
                            <td style="padding: 8px 0; text-align: right; font-size: 24px; font-weight: 700; color: ${BRAND_COLORS.navy};">€${(data.total / 100).toFixed(2)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Shipping Address -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-left: 4px solid ${BRAND_COLORS.navy}; border-radius: 0 12px 12px 0; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 10px 0; font-weight: 700; color: ${BRAND_COLORS.navy}; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">📍 Dirección de Envío</p>
                        <p style="margin: 0; color: #374151; line-height: 1.6;">${data.shippingAddress}<br>${data.postalCode} ${data.city}</p>
                        ${data.phone ? `<p style="margin: 10px 0 0 0; color: #6b7280;">📞 ${data.phone}</p>` : ''}
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${siteUrl}/perfil" style="display: block; background-color: ${BRAND_COLORS.navy}; color: #ffffff; padding: 18px 30px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; text-align: center;">Ver Mis Pedidos</a>
                      </td>
                    </tr>
                  </table>

                  ${data.invoiceNumber && data.invoiceId ? `
                  <!-- Invoice Section -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 25px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; overflow: hidden;">
                    <tr>
                      <td style="padding: 25px; text-align: center;">
                        <div style="font-size: 40px; margin-bottom: 10px;">📄</div>
                        <h3 style="color: ${BRAND_COLORS.navy}; font-size: 18px; font-weight: 700; margin: 0 0 8px 0;">Tu Factura Está Lista</h3>
                        <p style="color: #0369a1; font-size: 15px; margin: 0 0 20px 0; font-weight: 600;">Factura #${data.invoiceNumber}</p>
                        <a href="${siteUrl}/pedido/${data.orderNumber}#factura" style="display: inline-block; background-color: #0284c7; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
                          Ver Detalles y Factura
                        </a>
                        <p style="color: #64748b; font-size: 13px; margin: 15px 0 0 0;">
                          Haz clic para ver tu pedido completo y descargar tu factura
                        </p>
                      </td>
                    </tr>
                  </table>
                  ` : ''}

                  <p style="color: #6b7280; font-size: 15px; text-align: center; margin: 30px 0 0 0; line-height: 1.6;">
                    Recibirás un email cuando tu pedido sea enviado.<br>
                    ¿Preguntas? <a href="${siteUrl}/contacto" style="color: ${BRAND_COLORS.navy}; text-decoration: underline;">Contáctanos</a>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">© 2026 Vantage. Moda Masculina Premium.</p>
                  <p style="margin: 0; font-size: 14px;">
                    <a href="${siteUrl}/privacidad" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Privacidad</a>
                    <span style="color: #d1d5db; margin: 0 10px;">·</span>
                    <a href="${siteUrl}/terminos" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Términos</a>
                    <span style="color: #d1d5db; margin: 0 10px;">·</span>
                    <a href="${siteUrl}" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Visitar Tienda</a>
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    const result = await resend!.emails.send({
      from: 'Vantage <onboarding@resend.dev>',
      to: data.customerEmail,
      subject: `✅ ¡Pedido Confirmado! #${data.orderNumber} - Vantage`,
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
  baseUrl?: string;
}) {
  if (!resend) {
    console.warn('⚠️ Resend no configurado, shipping notification no enviado');
    return null;
  }
  try {
    const siteUrl = data.baseUrl || import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
    const logoUrl = `${siteUrl}/images/vantage-logo.jpg`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f5f0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f5f0; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 45px 30px; text-align: center;">
                  <img src="${logoUrl}" alt="Vantage" width="80" height="80" style="border-radius: 12px; margin-bottom: 15px; object-fit: cover;" />
                  <p style="font-size: 50px; margin: 0 0 15px 0;">📦</p>
                  <h1 style="color: #ffffff; font-size: 28px; font-weight: 600; margin: 0; line-height: 1.3;">¡Tu Pedido ha sido Enviado!</h1>
                  <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 12px 0 0 0;">Está en camino hacia ti</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="font-size: 18px; color: #374151; margin: 0 0 25px 0; line-height: 1.5;">
                    Hola <strong style="color: ${BRAND_COLORS.navy};">${data.customerName}</strong>,
                  </p>
                  
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.7; margin: 0 0 30px 0;">
                    ¡Buenas noticias! Tu pedido ya está en camino. Pronto lo tendrás en tus manos.
                  </p>

                  <!-- Order Info Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 16px; margin-bottom: 25px; border: 2px solid #10b981;">
                    <tr>
                      <td style="padding: 30px; text-align: center;">
                        <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.1em;">Número de Pedido</p>
                        <p style="font-size: 28px; font-weight: 700; color: #065f46; margin: 0 0 20px 0;">#${data.orderNumber}</p>
                        
                        ${data.trackingNumber ? `
                        <table width="100%" cellpadding="0" cellspacing="0" style="background: white; border-radius: 12px; margin-top: 15px;">
                          <tr>
                            <td style="padding: 20px; text-align: center;">
                              <p style="font-size: 14px; color: #6b7280; margin: 0 0 5px 0;">📍 Número de Seguimiento</p>
                              <p style="font-size: 20px; font-weight: 700; color: ${BRAND_COLORS.navy}; margin: 0; font-family: monospace; letter-spacing: 0.05em;">${data.trackingNumber}</p>
                            </td>
                          </tr>
                        </table>
                        ` : ''}
                        
                        ${data.estimatedDelivery ? `
                        <table width="100%" cellpadding="0" cellspacing="0" style="background: white; border-radius: 12px; margin-top: 15px;">
                          <tr>
                            <td style="padding: 20px; text-align: center;">
                              <p style="font-size: 14px; color: #6b7280; margin: 0 0 5px 0;">📅 Entrega Estimada</p>
                              <p style="font-size: 18px; font-weight: 700; color: #059669; margin: 0;">${data.estimatedDelivery}</p>
                            </td>
                          </tr>
                        </table>
                        ` : ''}
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${siteUrl}/perfil" style="display: block; background-color: #3b82f6; color: #ffffff; padding: 18px 30px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; text-align: center;">Rastrear Pedido</a>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #6b7280; font-size: 15px; text-align: center; margin: 30px 0 0 0; line-height: 1.6;">
                    Te avisaremos cuando llegue a su destino.<br>
                    ¿Preguntas? <a href="${siteUrl}/contacto" style="color: ${BRAND_COLORS.navy}; text-decoration: underline;">Contáctanos</a>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">© 2026 Vantage. Moda Masculina Premium.</p>
                  <p style="margin: 0; font-size: 14px;">
                    <a href="${siteUrl}/privacidad" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Privacidad</a>
                    <span style="color: #d1d5db; margin: 0 10px;">·</span>
                    <a href="${siteUrl}/terminos" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Términos</a>
                    <span style="color: #d1d5db; margin: 0 10px;">·</span>
                    <a href="${siteUrl}" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Visitar Tienda</a>
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    const result = await resend!.emails.send({
      from: 'Vantage <onboarding@resend.dev>',
      to: data.customerEmail,
      subject: `📦 ¡Tu pedido ha sido enviado! #${data.orderNumber} - Vantage`,
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
  baseUrl?: string;
}) {
  if (!resend) {
    console.warn('⚠️ Resend no configurado, delivery confirmation no enviado');
    return null;
  }
  try {
    const siteUrl = data.baseUrl || import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
    const logoUrl = `${siteUrl}/images/vantage-logo.jpg`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f5f0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f5f0; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 45px 30px; text-align: center;">
                  <img src="${logoUrl}" alt="Vantage" width="80" height="80" style="border-radius: 12px; margin-bottom: 15px; object-fit: cover;" />
                  <p style="font-size: 60px; margin: 0 0 15px 0;">🎉</p>
                  <h1 style="color: #ffffff; font-size: 28px; font-weight: 600; margin: 0; line-height: 1.3;">¡Pedido Entregado!</h1>
                  <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 12px 0 0 0;">Tu pedido ha llegado a su destino</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="font-size: 18px; color: #374151; margin: 0 0 25px 0; line-height: 1.5;">
                    Hola <strong style="color: ${BRAND_COLORS.navy};">${data.customerName}</strong>,
                  </p>
                  
                  <!-- Success Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 16px; margin-bottom: 25px; border: 2px solid #10b981;">
                    <tr>
                      <td style="padding: 30px; text-align: center;">
                        <p style="font-size: 50px; margin: 0 0 15px 0;">✅</p>
                        <p style="font-size: 20px; font-weight: 700; color: #065f46; margin: 0 0 10px 0;">¡Entrega completada!</p>
                        <p style="font-size: 14px; color: #6b7280; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.1em;">Pedido</p>
                        <p style="font-size: 28px; font-weight: 700; color: #059669; margin: 0;">#${data.orderNumber}</p>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #4b5563; font-size: 16px; line-height: 1.7; margin: 0 0 25px 0; text-align: center;">
                    Esperamos que disfrutes tu compra. Si tienes algún problema, estamos aquí para ayudarte.
                  </p>

                  <!-- Review CTA -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 12px; margin-bottom: 25px;">
                    <tr>
                      <td style="padding: 25px; text-align: center;">
                        <p style="font-size: 16px; color: #374151; margin: 0 0 15px 0; font-weight: 600;">
                          ⭐ ¿Te ha gustado tu experiencia?
                        </p>
                        <p style="font-size: 14px; color: #6b7280; margin: 0 0 20px 0;">
                          Tu opinión nos ayuda a mejorar. ¡Déjanos una reseña!
                        </p>
                        <a href="${siteUrl}" style="background-color: ${BRAND_COLORS.gold}; color: #1a2744; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; display: inline-block;">Dejar una Reseña</a>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${siteUrl}" style="display: block; background-color: ${BRAND_COLORS.navy}; color: #ffffff; padding: 18px 30px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; text-align: center;">Seguir Comprando</a>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #6b7280; font-size: 15px; text-align: center; margin: 30px 0 0 0; line-height: 1.6;">
                    ¡Gracias por confiar en Vantage! 💙<br>
                    <a href="${siteUrl}/contacto" style="color: ${BRAND_COLORS.navy}; text-decoration: underline;">Contactar Soporte</a>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">© 2026 Vantage. Moda Masculina Premium.</p>
                  <p style="margin: 0; font-size: 14px;">
                    <a href="${siteUrl}/privacidad" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Privacidad</a>
                    <span style="color: #d1d5db; margin: 0 10px;">·</span>
                    <a href="${siteUrl}/terminos" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Términos</a>
                    <span style="color: #d1d5db; margin: 0 10px;">·</span>
                    <a href="${siteUrl}" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Visitar Tienda</a>
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    const result = await resend!.emails.send({
      from: 'Vantage <onboarding@resend.dev>',
      to: data.customerEmail,
      subject: `🎉 ¡Pedido Entregado! #${data.orderNumber} - Vantage`,
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
  items?: Array<{
    productName: string;
    quantity: number;
    price: number;
    image?: string;
    size?: string;
  }>;
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

            ${data.items && data.items.length > 0 ? `
            <div style="margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 12px;">
              <h3 style="margin: 0 0 15px 0; color: ${BRAND_COLORS.navy}; font-size: 16px; font-weight: 600;">📦 Productos a Preparar</h3>
              ${data.items.map(item => `
                <div style="display: flex; gap: 12px; padding: 12px; background: white; border-radius: 8px; margin-bottom: 10px; align-items: center;">
                  ${item.image ? `
                    <img src="${item.image}" alt="${item.productName}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb;">
                  ` : `
                    <div style="width: 60px; height: 60px; background: #f3f4f6; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px;">📦</div>
                  `}
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: ${BRAND_COLORS.navy}; font-size: 14px;">${item.productName}</div>
                    ${item.size ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Talla: ${item.size}</div>` : ''}
                    <div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">Cantidad: ${item.quantity}</div>
                  </div>
                  <div style="text-align: right; font-weight: 700; color: ${BRAND_COLORS.success};">
                    €${((item.price * item.quantity) / 100).toFixed(2)}
                  </div>
                </div>
              `).join('')}
            </div>
            ` : ''}

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

// Umbral de stock bajo por defecto
export const LOW_STOCK_THRESHOLD = 5;

// Función para obtener el umbral de stock desde la BD
export async function getLowStockThreshold(): Promise<number> {
  try {
    const { supabase, isSupabaseConfigured } = await import('./supabase');
    if (!isSupabaseConfigured) return LOW_STOCK_THRESHOLD;

    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'low_stock_threshold')
      .single();

    return data?.value ? parseInt(data.value) : LOW_STOCK_THRESHOLD;
  } catch {
    return LOW_STOCK_THRESHOLD;
  }
}

// Email del administrador para alertas
const ADMIN_ALERT_EMAIL = 'p2590149@gmail.com';

// URL del logo de Vantage
const VANTAGE_LOGO_URL = '/images/vantage-logo.jpg';

export interface LowStockProduct {
  id: number;
  name: string;
  stock: number;
  slug?: string;
  image?: string;
  size?: string; // Para alertas por talla
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
      .map(p => {
        // Solo usar imagen si es URL absoluta (de Supabase storage)
        const hasValidImage = p.image && p.image.startsWith('http');
        const sizeLabel = p.size ? ` (Talla ${p.size})` : '';

        return `
        <tr>
          <td style="padding: 18px 15px; border-bottom: 1px solid #e5e7eb;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                ${hasValidImage ? `
                <td width="70" style="vertical-align: middle; padding-right: 15px;">
                  <img src="${p.image}" alt="${p.name}" width="60" height="75" style="border-radius: 8px; object-fit: cover; display: block; border: 1px solid #e5e7eb;" />
                </td>
                ` : ''}
                <td style="vertical-align: middle;">
                  <p style="margin: 0; font-weight: 600; color: ${BRAND_COLORS.navy}; font-size: 15px;">${p.name}${sizeLabel}</p>
                  <p style="margin: 8px 0 0 0;">
                    <span style="background-color: ${p.stock === 0 ? '#fee2e2' : '#fef3c7'}; color: ${p.stock === 0 ? '#dc2626' : '#d97706'}; padding: 5px 14px; border-radius: 20px; font-weight: 700; font-size: 13px;">
                      ${p.stock} ${p.stock === 0 ? 'AGOTADO' : 'unidades'}
                    </span>
                  </p>
                </td>
                <td width="100" style="text-align: right; vertical-align: middle; padding-left: 15px;">
                  <a href="${siteUrl}/admin/productos/${p.id}" style="background-color: ${BRAND_COLORS.navy}; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; display: inline-block;">Gestionar</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
      })
      .join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f5f0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f5f0; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${BRAND_COLORS.navy} 0%, ${BRAND_COLORS.navyLight} 100%); padding: 45px 30px; text-align: center;">
                  <p style="font-size: 24px; font-weight: 300; letter-spacing: 0.3em; color: ${BRAND_COLORS.gold}; margin: 0 0 20px 0;">VANTAGE</p>
                  <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background-color: #fef3c7; width: 70px; height: 70px; border-radius: 50%; text-align: center; vertical-align: middle;">
                        <span style="font-size: 36px; line-height: 70px;">⚠️</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #ffffff; font-size: 28px; font-weight: 600; margin: 0; line-height: 1.3;">Alerta de Stock Bajo</h1>
                  <p style="color: rgba(255,255,255,0.85); font-size: 16px; margin: 12px 0 0 0;">Sistema de Inventario</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <!-- Alert Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 5px solid #d97706; border-radius: 0 12px 12px 0; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 20px 25px;">
                        <p style="margin: 0; color: #92400e; font-weight: 700; font-size: 17px;">
                          ${products.length} producto${products.length > 1 ? 's' : ''} con stock bajo
                        </p>
                        <p style="margin: 10px 0 0 0; color: #a16207; font-size: 15px; line-height: 1.5;">
                          Stock igual o inferior a ${LOW_STOCK_THRESHOLD} unidades
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Products Table -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 12px; overflow: hidden; margin-bottom: 30px;">
                    ${productsListHtml}
                  </table>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${siteUrl}/admin/productos" style="display: block; background-color: ${BRAND_COLORS.navy}; color: #ffffff; padding: 18px 30px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; text-align: center;">Ir al Panel de Productos</a>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 30px 0 0 0; line-height: 1.5;">
                    Este es un mensaje automático de Vantage.<br>
                    Repón stock para evitar pérdidas de ventas.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0;">© 2026 Vantage. Moda Masculina Premium.</p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
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
  image?: string;
  size?: string; // Para alertas por talla
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
      .map(p => {
        const hasValidImage = p.image && p.image.startsWith('http');
        const sizeLabel = p.size ? ` (Talla ${p.size})` : '';

        return `
        <tr>
          <td style="padding: 20px; border-bottom: 1px solid #fecaca; background: white;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                ${hasValidImage ? `
                <td width="80" style="vertical-align: top; padding-right: 20px;">
                  <img src="${p.image}" alt="${p.name}" width="70" height="85" style="border-radius: 10px; object-fit: cover; display: block; border: 2px solid #fecaca;" />
                </td>
                ` : ''}
                <td style="vertical-align: top;">
                  <p style="margin: 0 0 10px 0; font-weight: 700; color: #1f2937; font-size: 16px;">${p.name}${sizeLabel}</p>
                  <span style="background-color: #dc2626; color: white; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 12px; display: inline-block;">
                    ⛔ AGOTADO
                  </span>
                </td>
              </tr>
              <tr>
                <td ${hasValidImage ? 'colspan="2"' : ''} style="padding-top: 15px;">
                  <a href="${siteUrl}/admin/productos/${p.id}" style="background-color: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block; width: 100%; text-align: center; box-sizing: border-box;">Reponer Stock</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
      })
      .join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f5f0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f5f0; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 45px 30px; text-align: center;">
                  <p style="font-size: 24px; font-weight: 300; letter-spacing: 0.3em; color: rgba(255,255,255,0.9); margin: 0 0 25px 0;">VANTAGE</p>
                  <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background-color: rgba(255,255,255,0.2); width: 80px; height: 80px; border-radius: 50%; text-align: center; vertical-align: middle;">
                        <span style="font-size: 40px; line-height: 80px;">🚨</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.3;">¡Productos Agotados!</h1>
                  <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 12px 0 0 0;">Alerta Crítica de Inventario</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <!-- Alert Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fee2e2; border-left: 5px solid #dc2626; border-radius: 0 12px 12px 0; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 20px 25px;">
                        <p style="margin: 0; color: #991b1b; font-weight: 700; font-size: 17px;">
                          ¡URGENTE! ${products.length} producto${products.length > 1 ? 's' : ''} sin stock
                        </p>
                        <p style="margin: 10px 0 0 0; color: #b91c1c; font-size: 15px; line-height: 1.5;">
                          Los clientes no pueden comprar hasta que repongas el inventario.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Products Table -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border-radius: 12px; overflow: hidden; margin-bottom: 30px;">
                    ${productsListHtml}
                  </table>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${siteUrl}/admin/productos" style="display: block; background-color: #dc2626; color: #ffffff; padding: 18px 30px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; text-align: center;">Gestionar Inventario Ahora</a>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 30px 0 0 0; line-height: 1.5;">
                    Este es un mensaje automático de Vantage.<br>
                    ⚡ Repón stock lo antes posible para no perder ventas.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0;">© 2026 Vantage. Moda Masculina Premium.</p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
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

// =====================================================
// WISHLIST LOW STOCK EMAIL (ALERTA A USUARIOS)
// =====================================================

export interface WishlistLowStockEmailData {
  customerEmail: string;
  customerName?: string;
  productName: string;
  productSlug: string;
  productImage: string;
  productPrice: number;
  size: string;
  stockLeft: number;
  baseUrl?: string;
}

/**
 * Extrae el nombre del usuario del email
 */
function extractNameFromEmail(email: string, providedName?: string): string {
  if (providedName && providedName.trim() && providedName !== 'Cliente') {
    return providedName;
  }
  // Extraer la parte antes del @
  const namePart = email.split('@')[0];
  // Capitalizar primera letra y limpiar números/caracteres
  const cleanName = namePart
    .replace(/[0-9_.-]/g, ' ')
    .trim()
    .split(' ')[0];
  return cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
}

/**
 * Envía email a un usuario cuando su producto favorito tiene pocas unidades
 */
export async function sendWishlistLowStockEmail(data: WishlistLowStockEmailData): Promise<boolean> {
  if (!resend) {
    console.warn('⚠️ Resend no configurado, email de wishlist stock bajo no enviado');
    return false;
  }

  try {
    const siteUrl = data.baseUrl || import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
    const productUrl = `${siteUrl}/productos/${data.productSlug}`;
    const priceFormatted = (data.productPrice / 100).toFixed(2);
    const customerName = extractNameFromEmail(data.customerEmail, data.customerName);

    // Asegurarse de que la imagen es una URL completa
    let imageUrl = data.productImage || '';
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `${siteUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
    }

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f5f0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f5f0; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${BRAND_COLORS.navy} 0%, ${BRAND_COLORS.navyLight} 100%); padding: 45px 30px; text-align: center;">
                  <p style="font-size: 18px; font-weight: 300; letter-spacing: 0.3em; color: ${BRAND_COLORS.gold}; margin: 0 0 20px 0;">VANTAGE</p>
                  <p style="font-size: 50px; margin: 0 0 15px 0;">❤️</p>
                  <h1 style="color: #ffffff; font-size: 28px; font-weight: 600; margin: 0; line-height: 1.3;">Tu favorito se está agotando</h1>
                  <p style="color: rgba(255,255,255,0.85); font-size: 16px; margin: 12px 0 0 0;">Quedan pocas unidades disponibles</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="font-size: 18px; color: #374151; margin: 0 0 25px 0; line-height: 1.5;">
                    Hola <strong style="color: ${BRAND_COLORS.navy};">${customerName}</strong>,
                  </p>
                  
                  <p style="color: #4b5563; font-size: 17px; line-height: 1.7; margin: 0 0 35px 0;">
                    Sabemos que te encanta este producto de tu lista de deseos. 
                    Queríamos avisarte de que <strong>quedan muy pocas unidades</strong> en tu talla.
                  </p>

                  <!-- Product Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 16px; overflow: hidden; margin-bottom: 35px;">
                    <tr>
                      <td style="padding: 25px; text-align: center;">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${data.productName}" width="180" height="220" style="border-radius: 12px; object-fit: cover; display: block; margin: 0 auto 20px auto;" />` : '<div style="width: 180px; height: 220px; background: #e5e7eb; border-radius: 12px; margin: 0 auto 20px auto;"></div>'}
                        <h2 style="font-size: 22px; font-weight: 600; color: ${BRAND_COLORS.navy}; margin: 0 0 15px 0;">${data.productName}</h2>
                        <p style="margin: 0 0 15px 0;">
                          <span style="background-color: ${BRAND_COLORS.navy}; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">Talla ${data.size}</span>
                        </p>
                        <p style="font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.navy}; margin: 0;">€${priceFormatted}</p>
                      </td>
                    </tr>
                  </table>

                  <!-- Urgency Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8; border-left: 5px solid ${BRAND_COLORS.navy}; border-radius: 0 12px 12px 0; margin-bottom: 35px;">
                    <tr>
                      <td style="padding: 20px 25px;">
                        <p style="margin: 0; color: ${BRAND_COLORS.navy}; font-weight: 700; font-size: 17px;">⏰ ¡Últimas unidades disponibles!</p>
                        <p style="margin: 10px 0 0 0; color: #4b5563; font-size: 16px; line-height: 1.5;">No dejes escapar tu favorito. Los productos populares se agotan rápidamente.</p>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${productUrl}" style="display: block; background-color: ${BRAND_COLORS.navy}; color: #ffffff; padding: 18px 30px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; text-align: center;">Ver Producto</a>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #6b7280; font-size: 15px; text-align: center; margin: 35px 0 0 0; line-height: 1.5;">
                    Este producto está en tu lista de deseos.<br>
                    <a href="${siteUrl}/favoritos" style="color: ${BRAND_COLORS.navy}; text-decoration: underline; font-weight: 500;">Gestionar favoritos</a>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">© 2026 Vantage. Moda Masculina Premium.</p>
                  <p style="margin: 0; font-size: 14px;">
                    <a href="${siteUrl}/privacidad" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Privacidad</a>
                    <span style="color: #d1d5db; margin: 0 10px;">·</span>
                    <a href="${siteUrl}/terminos" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Términos</a>
                    <span style="color: #d1d5db; margin: 0 10px;">·</span>
                    <a href="${siteUrl}" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Visitar Tienda</a>
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    const result = await resend!.emails.send({
      from: 'Vantage <onboarding@resend.dev>',
      to: data.customerEmail,
      subject: `❤️ ¡Últimas unidades de ${data.productName}! - Tu favorito se agota`,
      html,
    });

    console.log(`Wishlist low stock email sent to ${data.customerEmail}:`, result);
    return true;
  } catch (error) {
    console.error('Error sending wishlist low stock email:', error);
    return false;
  }
}

// =====================================================
// WISHLIST SALE EMAIL (PRODUCTO EN OFERTA)
// =====================================================

export interface WishlistSaleEmailData {
  customerEmail: string;
  customerName?: string;
  productName: string;
  productSlug: string;
  productImage: string;
  originalPrice: number;
  salePrice: number;
  discountPercentage: number;
  size: string;
  baseUrl?: string;
}

/**
 * Envía email a un usuario cuando su producto favorito entra en oferta
 */
export async function sendWishlistSaleEmail(data: WishlistSaleEmailData): Promise<boolean> {
  if (!resend) {
    console.warn('⚠️ Resend no configurado, email de wishlist en oferta no enviado');
    return false;
  }

  try {
    const siteUrl = data.baseUrl || import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
    const productUrl = `${siteUrl}/productos/${data.productSlug}`;
    const originalPriceFormatted = (data.originalPrice / 100).toFixed(2);
    const salePriceFormatted = (data.salePrice / 100).toFixed(2);
    const customerName = extractNameFromEmail(data.customerEmail, data.customerName);

    // Asegurarse de que la imagen es una URL completa
    let imageUrl = data.productImage || '';
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `${siteUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
    }

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f5f0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f5f0; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${BRAND_COLORS.navy} 0%, ${BRAND_COLORS.navyLight} 100%); padding: 45px 30px; text-align: center;">
                  <p style="font-size: 18px; font-weight: 300; letter-spacing: 0.3em; color: ${BRAND_COLORS.gold}; margin: 0 0 20px 0;">VANTAGE</p>
                  <p style="font-size: 50px; margin: 0 0 15px 0;">🏷️</p>
                  <h1 style="color: #ffffff; font-size: 28px; font-weight: 600; margin: 0; line-height: 1.3;">¡Tu favorito está en oferta!</h1>
                  <p style="color: ${BRAND_COLORS.gold}; font-size: 24px; font-weight: 700; margin: 15px 0 0 0;">-${data.discountPercentage}% de descuento</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="font-size: 18px; color: #374151; margin: 0 0 25px 0; line-height: 1.5;">
                    Hola <strong style="color: ${BRAND_COLORS.navy};">${customerName}</strong>,
                  </p>
                  
                  <p style="color: #4b5563; font-size: 17px; line-height: 1.7; margin: 0 0 35px 0;">
                    ¡Buenas noticias! Un producto de tu lista de deseos acaba de entrar en oferta. 
                    Es el momento perfecto para hacerte con él.
                  </p>

                  <!-- Product Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 16px; overflow: hidden; margin-bottom: 35px; border: 3px solid ${BRAND_COLORS.gold};">
                    <tr>
                      <td style="padding: 25px; text-align: center;">
                        <p style="background-color: #dc2626; color: #ffffff; padding: 8px 18px; border-radius: 8px; font-size: 18px; font-weight: 700; display: inline-block; margin: 0 0 20px 0;">-${data.discountPercentage}%</p>
                        ${imageUrl ? `<img src="${imageUrl}" alt="${data.productName}" width="180" height="220" style="border-radius: 12px; object-fit: cover; display: block; margin: 0 auto 20px auto;" />` : '<div style="width: 180px; height: 220px; background: #e5e7eb; border-radius: 12px; margin: 0 auto 20px auto;"></div>'}
                        <h2 style="font-size: 22px; font-weight: 600; color: ${BRAND_COLORS.navy}; margin: 0 0 15px 0;">${data.productName}</h2>
                        <p style="margin: 0 0 15px 0;">
                          <span style="background-color: ${BRAND_COLORS.navy}; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">Talla ${data.size}</span>
                        </p>
                        <p style="margin: 0;">
                          <span style="font-size: 18px; color: #9ca3af; text-decoration: line-through;">€${originalPriceFormatted}</span>
                          <span style="font-size: 32px; font-weight: 700; color: #dc2626; margin-left: 12px;">€${salePriceFormatted}</span>
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Sale Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border-left: 5px solid #dc2626; border-radius: 0 12px 12px 0; margin-bottom: 35px;">
                    <tr>
                      <td style="padding: 20px 25px;">
                        <p style="margin: 0; color: #dc2626; font-weight: 700; font-size: 17px;">🔥 Oferta por tiempo limitado</p>
                        <p style="margin: 10px 0 0 0; color: #4b5563; font-size: 16px; line-height: 1.5;">Aprovecha este descuento antes de que termine la promoción.</p>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${productUrl}" style="display: block; background-color: #dc2626; color: #ffffff; padding: 18px 30px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; text-align: center;">Comprar con Descuento</a>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #6b7280; font-size: 15px; text-align: center; margin: 35px 0 0 0; line-height: 1.5;">
                    Este producto está en tu lista de deseos.<br>
                    <a href="${siteUrl}/favoritos" style="color: ${BRAND_COLORS.navy}; text-decoration: underline; font-weight: 500;">Gestionar favoritos</a>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">© 2026 Vantage. Moda Masculina Premium.</p>
                  <p style="margin: 0; font-size: 14px;">
                    <a href="${siteUrl}/privacidad" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Privacidad</a>
                    <span style="color: #d1d5db; margin: 0 10px;">·</span>
                    <a href="${siteUrl}/terminos" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Términos</a>
                    <span style="color: #d1d5db; margin: 0 10px;">·</span>
                    <a href="${siteUrl}" style="color: ${BRAND_COLORS.navy}; text-decoration: none;">Visitar Tienda</a>
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    const result = await resend!.emails.send({
      from: 'Vantage <onboarding@resend.dev>',
      to: data.customerEmail,
      subject: `🏷️ ¡${data.discountPercentage}% OFF en ${data.productName}! - Tu favorito está de oferta`,
      html,
    });

    console.log(`Wishlist sale email sent to ${data.customerEmail}:`, result);
    return true;
  } catch (error) {
    console.error('Error sending wishlist sale email:', error);
    return false;
  }
}

