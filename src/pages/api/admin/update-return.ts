import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { Resend } from 'resend';
import Stripe from 'stripe';

const resendApiKey = import.meta.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Inicializar Stripe
const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const BRAND_COLORS = {
    navy: '#1a2744',
    purple: '#7c3aed',
    success: '#16a34a'
};

/**
 * Procesa el reembolso real en Stripe
 */
async function processStripeRefund(
    paymentIntentId: string,
    amountCents: number
): Promise<{ success: boolean; refundId?: string; error?: string }> {
    if (!stripe) {
        return { success: false, error: 'Stripe no está configurado' };
    }

    try {
        // Crear el reembolso en Stripe
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: amountCents, // Cantidad en céntimos (permite reembolso parcial)
            reason: 'requested_by_customer'
        });

        console.log(`✅ Reembolso Stripe creado: ${refund.id} - ${amountCents / 100}€`);

        return {
            success: true,
            refundId: refund.id
        };
    } catch (error: any) {
        console.error('Error en reembolso Stripe:', error);

        // Manejar errores específicos de Stripe
        let errorMessage = 'Error al procesar el reembolso en Stripe';

        if (error.type === 'StripeInvalidRequestError') {
            if (error.code === 'charge_already_refunded') {
                errorMessage = 'Este pago ya ha sido reembolsado anteriormente';
            } else if (error.code === 'amount_too_large') {
                errorMessage = 'El importe del reembolso supera el pago original';
            } else if (error.code === 'charge_disputed') {
                errorMessage = 'No se puede reembolsar: el pago está en disputa';
            } else {
                errorMessage = error.message || errorMessage;
            }
        } else if (error.type === 'StripeAPIError') {
            errorMessage = 'Error de conexión con Stripe. Inténtalo de nuevo.';
        }

        return { success: false, error: errorMessage };
    }
}

/**
 * API para actualizar estado de devolución (admin)
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        const { returnId, status, adminNotes, refundAmount } = await request.json();

        if (!returnId || !status) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Datos incompletos'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Obtener la devolución actual
        const { data: returnData, error: fetchError } = await supabase
            .from('returns')
            .select('*')
            .eq('id', returnId)
            .single();

        if (fetchError || !returnData) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Devolución no encontrada'
            }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // Preparar datos de actualización
        const updateData: any = {
            status,
            updated_at: new Date().toISOString()
        };

        if (adminNotes) {
            updateData.admin_notes = adminNotes;
        }

        if (status === 'received') {
            updateData.received_at = new Date().toISOString();
        }

        // ============================================
        // PROCESAR REEMBOLSO REAL EN STRIPE
        // ============================================
        let stripeRefundId: string | null = null;

        if (status === 'refunded') {
            updateData.refunded_at = new Date().toISOString();
            const finalAmount = refundAmount ?? returnData.refund_amount;

            if (finalAmount !== undefined) {
                updateData.refund_amount = finalAmount;
            }

            // Obtener el pedido para conseguir el payment_intent_id
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select('stripe_payment_intent_id')
                .eq('id', returnData.order_id)
                .single();

            if (orderError || !orderData) {
                console.error('Error obteniendo pedido:', orderError);
                return new Response(JSON.stringify({
                    success: false,
                    error: 'No se pudo obtener la información del pedido'
                }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }

            if (!orderData.stripe_payment_intent_id) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Este pedido no tiene un pago de Stripe registrado. No se puede procesar el reembolso automáticamente.'
                }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            // Procesar reembolso en Stripe
            const refundResult = await processStripeRefund(
                orderData.stripe_payment_intent_id,
                finalAmount || returnData.refund_amount || 0
            );

            if (!refundResult.success) {
                return new Response(JSON.stringify({
                    success: false,
                    error: refundResult.error
                }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            // Guardar el ID del reembolso de Stripe
            stripeRefundId = refundResult.refundId || null;
            if (stripeRefundId) {
                updateData.stripe_refund_id = stripeRefundId;
            }

            console.log(`💰 Reembolso procesado para devolución ${returnData.return_number}: ${stripeRefundId}`);
        }

        // Actualizar la devolución en la base de datos
        const { error: updateError } = await supabase
            .from('returns')
            .update(updateData)
            .eq('id', returnId);

        if (updateError) {
            console.error('Error updating return:', updateError);
            return new Response(JSON.stringify({
                success: false,
                error: 'Error al actualizar la devolución en la base de datos'
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        // Enviar email según estado
        let emailSent = false;
        if (resend) {
            try {
                if (status === 'received') {
                    // Email: Paquete recibido, en revisión
                    await resend.emails.send({
                        from: 'Vantage <onboarding@resend.dev>',
                        to: returnData.customer_email,
                        subject: `📦 Hemos recibido tu devolución - ${returnData.return_number}`,
                        html: getReceivedEmailHtml(returnData.customer_name, returnData.return_number)
                    });
                    emailSent = true;
                } else if (status === 'refunded') {
                    // Email: Reembolso procesado
                    const amount = refundAmount || returnData.refund_amount || 0;
                    await resend.emails.send({
                        from: 'Vantage <onboarding@resend.dev>',
                        to: returnData.customer_email,
                        subject: `✅ Reembolso procesado - ${returnData.return_number}`,
                        html: getRefundEmailHtml(returnData.customer_name, returnData.return_number, amount)
                    });
                    emailSent = true;
                } else if (status === 'rejected') {
                    await resend.emails.send({
                        from: 'Vantage <onboarding@resend.dev>',
                        to: returnData.customer_email,
                        subject: `Actualización sobre tu devolución - ${returnData.return_number}`,
                        html: getRejectedEmailHtml(returnData.customer_name, returnData.return_number, adminNotes || '')
                    });
                    emailSent = true;
                }
            } catch (emailError) {
                console.error('Error sending email:', emailError);
            }
        }

        // Respuesta con información adicional del reembolso
        const responseData: any = {
            success: true,
            message: status === 'refunded'
                ? `Reembolso procesado correctamente en Stripe`
                : `Devolución actualizada a "${status}"`,
            emailSent
        };

        if (stripeRefundId) {
            responseData.stripeRefundId = stripeRefundId;
        }

        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: (error as Error).message
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};

/**
 * Email: Paquete recibido, en revisión (2-4 días)
 */
function getReceivedEmailHtml(customerName: string, returnNumber: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: ${BRAND_COLORS.purple}; color: white; padding: 40px; text-align: center; }
            .logo { font-size: 20px; font-weight: 300; letter-spacing: 0.3em; margin-bottom: 10px; opacity: 0.9; }
            .content { padding: 40px; }
            .status-box { background: #f5f3ff; border: 2px solid #c4b5fd; border-radius: 16px; padding: 25px; margin: 25px 0; text-align: center; }
            .timeline { margin: 30px 0; }
            .timeline-item { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; }
            .timeline-dot { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
            .timeline-dot.done { background: ${BRAND_COLORS.success}; color: white; }
            .timeline-dot.current { background: ${BRAND_COLORS.purple}; color: white; animation: pulse 2s infinite; }
            .timeline-dot.pending { background: #e5e7eb; color: #9ca3af; }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
            .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 25px 0; }
            .footer { text-align: center; padding: 30px; background: #f9fafb; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="header">
                    <div class="logo">VANTAGE</div>
                    <p style="font-size: 48px; margin: 0;">📦</p>
                    <h1 style="margin: 15px 0 0 0; font-weight: 400;">¡Hemos recibido tu paquete!</h1>
                </div>
                <div class="content">
                    <p>Hola <strong>${customerName}</strong>,</p>
                    <p>Te confirmamos que hemos recibido tu devolución en nuestro almacén. Nuestro equipo está revisando los artículos.</p>
                    
                    <div class="status-box">
                        <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Número de devolución</p>
                        <p style="margin: 0; font-size: 24px; font-weight: bold; color: ${BRAND_COLORS.purple};">${returnNumber}</p>
                        <p style="margin: 15px 0 0 0; font-size: 14px; color: #6b7280;">Estado: <strong style="color: ${BRAND_COLORS.purple};">En revisión</strong></p>
                    </div>

                    <div class="timeline">
                        <div class="timeline-item">
                            <div class="timeline-dot done">✓</div>
                            <div>
                                <p style="margin: 0; font-weight: 600; color: #374151;">Devolución solicitada</p>
                                <p style="margin: 0; font-size: 14px; color: #6b7280;">Recibimos tu solicitud</p>
                            </div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-dot done">✓</div>
                            <div>
                                <p style="margin: 0; font-weight: 600; color: #374151;">Paquete recibido</p>
                                <p style="margin: 0; font-size: 14px; color: #6b7280;">Llegó a nuestro almacén</p>
                            </div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-dot current">🔍</div>
                            <div>
                                <p style="margin: 0; font-weight: 600; color: ${BRAND_COLORS.purple};">En revisión</p>
                                <p style="margin: 0; font-size: 14px; color: #6b7280;">Verificando el estado de los artículos</p>
                            </div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-dot pending">4</div>
                            <div>
                                <p style="margin: 0; font-weight: 600; color: #9ca3af;">Reembolso</p>
                                <p style="margin: 0; font-size: 14px; color: #9ca3af;">Pendiente de procesar</p>
                            </div>
                        </div>
                    </div>

                    <div class="info-box">
                        <p style="margin: 0;"><strong>⏱️ Plazo de revisión: 2-4 días laborables</strong></p>
                        <p style="margin: 10px 0 0 0; font-size: 14px;">Una vez completada la revisión, te enviaremos otro email confirmando el reembolso.</p>
                    </div>
                    
                    <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
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
 * Email: Reembolso procesado correctamente
 */
function getRefundEmailHtml(customerName: string, returnNumber: string, amountCents: number): string {
    const amount = (amountCents / 100).toFixed(2).replace('.', ',');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: ${BRAND_COLORS.success}; color: white; padding: 40px; text-align: center; }
            .logo { font-size: 20px; font-weight: 300; letter-spacing: 0.3em; margin-bottom: 10px; opacity: 0.9; }
            .content { padding: 40px; }
            .success-box { background: #dcfce7; border: 2px solid #86efac; border-radius: 16px; padding: 30px; text-align: center; margin: 25px 0; }
            .amount { font-size: 42px; font-weight: bold; color: ${BRAND_COLORS.success}; }
            .timeline { margin: 30px 0; }
            .timeline-item { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; }
            .timeline-dot { width: 24px; height: 24px; border-radius: 50%; background: ${BRAND_COLORS.success}; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; }
            .info-box { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 25px 0; }
            .footer { text-align: center; padding: 30px; background: #f9fafb; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="header">
                    <div class="logo">VANTAGE</div>
                    <p style="font-size: 56px; margin: 0;">🎉</p>
                    <h1 style="margin: 15px 0 0 0; font-weight: 400;">¡Devolución Completada!</h1>
                </div>
                <div class="content">
                    <p>Hola <strong>${customerName}</strong>,</p>
                    <p>¡Buenas noticias! Hemos revisado tu devolución y <strong>todo está correcto</strong>. El reembolso se ha procesado satisfactoriamente.</p>
                    
                    <div class="success-box">
                        <p style="margin: 0 0 5px 0; color: #166534; font-size: 14px;">Importe a reembolsar</p>
                        <p class="amount">${amount} €</p>
                        <p style="margin: 10px 0 0 0; font-size: 14px; color: #166534;">Devolución ${returnNumber}</p>
                    </div>

                    <div class="timeline">
                        <div class="timeline-item">
                            <div class="timeline-dot">✓</div>
                            <div><p style="margin: 0; font-weight: 600; color: #374151;">Devolución solicitada</p></div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-dot">✓</div>
                            <div><p style="margin: 0; font-weight: 600; color: #374151;">Paquete recibido</p></div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-dot">✓</div>
                            <div><p style="margin: 0; font-weight: 600; color: #374151;">Revisión completada</p></div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-dot">✓</div>
                            <div><p style="margin: 0; font-weight: 600; color: ${BRAND_COLORS.success};">Reembolso procesado</p></div>
                        </div>
                    </div>

                    <div class="info-box">
                        <p style="margin: 0; font-weight: 600;">💳 ¿Cuándo recibiré el dinero?</p>
                        <p style="margin: 10px 0 0 0; font-size: 14px;">El importe se abonará en tu método de pago original en <strong>3-5 días laborables</strong>, dependiendo de tu entidad bancaria.</p>
                    </div>
                    
                    <p>Gracias por tu paciencia y por confiar en Vantage. ¡Esperamos verte pronto de nuevo!</p>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="https://vantage.com" style="display: inline-block; background: ${BRAND_COLORS.navy}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                            Seguir Comprando
                        </a>
                    </div>
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
 * Email: Devolución rechazada
 */
function getRejectedEmailHtml(customerName: string, returnNumber: string, reason: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: ${BRAND_COLORS.navy}; color: white; padding: 40px; text-align: center; }
            .logo { font-size: 20px; font-weight: 300; letter-spacing: 0.3em; margin-bottom: 10px; opacity: 0.9; }
            .content { padding: 40px; }
            .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
            .footer { text-align: center; padding: 30px; background: #f9fafb; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="header">
                    <div class="logo">VANTAGE</div>
                    <h1 style="margin: 0; font-weight: 400;">Actualización de tu devolución</h1>
                </div>
                <div class="content">
                    <p>Hola <strong>${customerName}</strong>,</p>
                    <p>Te escribimos respecto a tu solicitud de devolución <strong>${returnNumber}</strong>.</p>
                    
                    ${reason ? `
                    <div class="info-box">
                        <p style="margin: 0;"><strong>Mensaje del equipo:</strong></p>
                        <p style="margin: 10px 0 0 0;">${reason}</p>
                    </div>
                    ` : ''}
                    
                    <p>Si tienes alguna pregunta, no dudes en contactarnos respondiendo a este email.</p>
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
