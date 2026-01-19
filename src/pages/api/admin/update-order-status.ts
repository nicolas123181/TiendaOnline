import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { sendDeliveryConfirmationEmail } from '../../../lib/email';
import { Resend } from 'resend';

const resendApiKey = import.meta.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Colores de marca Vantage
const BRAND_COLORS = {
    navy: '#1a2744',
    navyLight: '#2d4a6f',
    warning: '#d97706',
    purple: '#7c3aed',
    success: '#16a34a'
};

/**
 * API para actualizar estado de pedido y enviar email
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        const {
            orderId,
            status,
            customerEmail,
            customerName,
            carrierId,
            carrierName,
            trackingNumber,
            trackingUrlTemplate
        } = await request.json();

        if (!orderId || !status) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Datos incompletos'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        console.log(`📦 Updating order #${orderId} to status: ${status}`);

        // Preparar datos de actualización
        const updateData: any = {
            status,
            updated_at: new Date().toISOString()
        };

        // Si es un envío con tracking, guardar datos del transportista
        if (status === 'shipped' && carrierId && trackingNumber) {
            updateData.carrier_id = carrierId;
            updateData.tracking_number = trackingNumber;
        }

        // Actualizar estado del pedido
        const { error: updateError } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId);

        if (updateError) {
            console.error('Error updating order:', updateError);
            return new Response(JSON.stringify({
                success: false,
                error: 'Error al actualizar el pedido'
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        // Enviar email según el estado
        let emailSent = false;
        let emailMessage = '';

        try {
            if (status === 'ready_for_pickup' && resend) {
                // Email de listo para RECOGER EN TIENDA
                await resend.emails.send({
                    from: 'Vantage <onboarding@resend.dev>',
                    to: customerEmail,
                    subject: `¡Tu pedido #${orderId} está listo para recoger!`,
                    html: getReadyForPickupEmailHtml(orderId, customerName)
                });
                emailSent = true;
                emailMessage = 'Email de recogida enviado';
                console.log(`✅ Ready for pickup email sent to ${customerEmail}`);

            } else if (status === 'shipped' && resend) {
                // Email de ENVÍO CON TRACKING
                const trackingUrl = trackingUrlTemplate
                    ? trackingUrlTemplate.replace('{tracking}', trackingNumber)
                    : '';

                await resend.emails.send({
                    from: 'Vantage <onboarding@resend.dev>',
                    to: customerEmail,
                    subject: `🚚 Tu pedido #${orderId} va en camino`,
                    html: getShippingWithTrackingEmailHtml(orderId, customerName, carrierName, trackingNumber, trackingUrl)
                });
                emailSent = true;
                emailMessage = 'Email de envío con tracking enviado';
                console.log(`✅ Shipping email with tracking sent to ${customerEmail}`);

            } else if (status === 'delivered') {
                // Email de entrega
                await sendDeliveryConfirmationEmail({
                    customerName,
                    customerEmail,
                    orderNumber: orderId.toString(),
                });
                emailSent = true;
                emailMessage = 'Email de entrega enviado';
                console.log(`✅ Delivery email sent to ${customerEmail}`);
            }
        } catch (emailError) {
            console.error('Error sending email:', emailError);
            emailMessage = 'Pedido actualizado pero el email falló';
        }

        return new Response(JSON.stringify({
            success: true,
            message: emailSent ? `Pedido actualizado. ${emailMessage}` : 'Pedido actualizado',
            emailSent
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: (error as Error).message
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};

/**
 * HTML para email de listo para recoger EN TIENDA
 */
function getReadyForPickupEmailHtml(orderId: number, customerName: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: ${BRAND_COLORS.warning}; color: white; padding: 40px; text-align: center; }
            .header h1 { margin: 15px 0 0 0; font-size: 24px; font-weight: 400; }
            .header .icon { font-size: 60px; margin-bottom: 15px; }
            .logo { font-size: 20px; font-weight: 300; letter-spacing: 0.3em; margin-bottom: 10px; opacity: 0.9; }
            .content { padding: 40px; }
            .order-number { background: #fef3c7; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
            .order-number span { font-size: 32px; font-weight: bold; color: ${BRAND_COLORS.warning}; }
            .info-box { background: #fffbeb; border-left: 4px solid ${BRAND_COLORS.warning}; padding: 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
            .button { display: inline-block; background: ${BRAND_COLORS.navy}; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 20px 0; }
            .footer { text-align: center; padding: 30px; background: #f9fafb; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="header">
                    <div class="logo">VANTAGE</div>
                    <div class="icon">🎉</div>
                    <h1>¡Tu pedido está listo!</h1>
                </div>
                <div class="content">
                    <p>Hola <strong>${customerName}</strong>,</p>
                    <p>Nos complace informarte que tu pedido está <strong>listo para recoger</strong> en nuestra tienda.</p>
                    
                    <div class="order-number">
                        <p style="margin: 0 0 5px 0; color: #6b7280;">Número de pedido</p>
                        <span>#${orderId.toString().padStart(5, '0')}</span>
                    </div>
                    
                    <div class="info-box">
                        <p style="margin: 0;"><strong>🏪 Recogida en Tienda</strong></p>
                        <p style="margin: 10px 0 0 0; color: #6b7280;">Pasa a recogerlo cuando desees. No olvides traer tu DNI o el número de pedido.</p>
                    </div>
                    
                    <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                    
                    <center>
                        <a href="https://vantage.com/perfil" class="button">Ver Detalles del Pedido</a>
                    </center>
                </div>
                <div class="footer">
                    <p>© 2026 Vantage. Todos los derechos reservados.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

/**
 * HTML para email de ENVÍO CON TRACKING
 */
function getShippingWithTrackingEmailHtml(
    orderId: number,
    customerName: string,
    carrierName: string,
    trackingNumber: string,
    trackingUrl: string
): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, ${BRAND_COLORS.purple} 0%, ${BRAND_COLORS.navyLight} 100%); color: white; padding: 40px; text-align: center; }
            .header h1 { margin: 15px 0 0 0; font-size: 24px; font-weight: 400; }
            .header .icon { font-size: 60px; margin-bottom: 15px; }
            .logo { font-size: 20px; font-weight: 300; letter-spacing: 0.3em; margin-bottom: 10px; opacity: 0.9; }
            .content { padding: 40px; }
            .order-number { background: #f5f3ff; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
            .order-number span { font-size: 28px; font-weight: bold; color: ${BRAND_COLORS.purple}; }
            .tracking-box { background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 2px solid #86efac; border-radius: 16px; padding: 25px; margin: 25px 0; text-align: center; }
            .tracking-box .carrier { font-size: 18px; font-weight: 600; color: ${BRAND_COLORS.navy}; margin-bottom: 10px; }
            .tracking-box .number { font-family: monospace; font-size: 20px; font-weight: bold; color: ${BRAND_COLORS.success}; background: white; padding: 12px 20px; border-radius: 8px; display: inline-block; margin: 10px 0; letter-spacing: 1px; }
            .tracking-btn { display: inline-block; background: ${BRAND_COLORS.success}; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 15px 0; font-size: 16px; }
            .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
            .footer { text-align: center; padding: 30px; background: #f9fafb; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="header">
                    <div class="logo">VANTAGE</div>
                    <div class="icon">🚚</div>
                    <h1>¡Tu pedido va en camino!</h1>
                </div>
                <div class="content">
                    <p>Hola <strong>${customerName}</strong>,</p>
                    <p>¡Buenas noticias! Tu pedido ha sido enviado y <strong>ya está en camino</strong> hacia ti.</p>
                    
                    <div class="order-number">
                        <p style="margin: 0 0 5px 0; color: #6b7280;">Pedido</p>
                        <span>#${orderId.toString().padStart(5, '0')}</span>
                    </div>
                    
                    <div class="tracking-box">
                        <p class="carrier">📦 Enviado con <strong>${carrierName}</strong></p>
                        <p style="margin: 5px 0; color: #6b7280;">Número de seguimiento:</p>
                        <div class="number">${trackingNumber}</div>
                        ${trackingUrl ? `
                        <br>
                        <a href="${trackingUrl}" class="tracking-btn" target="_blank">
                            🔍 Rastrear mi Pedido
                        </a>
                        ` : ''}
                    </div>
                    
                    <div class="info-box">
                        <p style="margin: 0;"><strong>💡 Consejo:</strong> Guarda este número de seguimiento para consultar el estado de tu envío en cualquier momento.</p>
                    </div>
                    
                    <p>Si tienes alguna pregunta sobre tu envío, no dudes en contactarnos.</p>
                </div>
                <div class="footer">
                    <p>© 2026 Vantage. Todos los derechos reservados.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}
