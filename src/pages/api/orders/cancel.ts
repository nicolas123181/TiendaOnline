import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase';
import { Resend } from 'resend';
import Stripe from 'stripe';

const resendApiKey = import.meta.env.RESEND_API_KEY;
const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;

const resend = resendApiKey ? new Resend(resendApiKey) : null;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const BRAND_COLORS = {
    navy: '#1a2744',
    red: '#dc2626',
    success: '#16a34a'
};

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { orderId } = await request.json();

        if (!orderId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'ID del pedido requerido'
            }), { status: 400 });
        }

        // 1. Verificar autenticación usando el helper robusto
        // createServerClient maneja automáticamente la obtención de tokens de las cookies
        const authClient = createServerClient(cookies);
        const { data: { user }, error: authError } = await authClient.auth.getUser();

        if (authError || !user) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Sesión inválida o expirada. Por favor recarga la página.'
            }), { status: 401 });
        }

        // Obtener pedido con items (usando authClient que ya sabemos que tiene sesión válida)
        const { data: order, error: orderError } = await authClient
            .from('orders')
            .select(`
                *,
                order_items(
                    id,
                    product_id,
                    quantity,
                    size,
                    product_name,
                    product_image
                )
            `)
            .eq('id', orderId)
            // Asegurarnos de que el pedido pertenece al usuario autenticado
            .eq('customer_email', user.email)
            .single();

        console.log('🔍 Debug Cancel:', {
            orderId,
            userEmail: user.email,
            found: !!order,
            error: orderError?.message
        });

        if (orderError || !order) {
            // Intento de debug adicional: buscar sin filtro de email para ver si existe
            return new Response(JSON.stringify({
                success: false,
                error: 'Pedido no encontrado.'
            }), { status: 404 });
        }

        // Verificar que el pedido está en estado "paid"
        if (order.status !== 'paid') {
            return new Response(JSON.stringify({
                success: false,
                error: 'Este pedido no puede cancelarse'
            }), { status: 400 });
        }

        // ============================================
        // EMAIL 1: CANCELACIÓN EN PROCESO
        // ============================================
        if (resend) {
            try {
                await resend.emails.send({
                    from: 'Vantage <onboarding@resend.dev>',
                    to: order.customer_email,
                    subject: `⏳ Procesando tu cancelación - Pedido #${orderId}`,
                    html: getProcessingEmailHtml(order.customer_name, orderId.toString())
                });
                console.log('📧 Email "En proceso" enviado');
            } catch (e) {
                console.error('Error enviando email en proceso:', e);
            }
        }

        // ============================================
        // 1. REEMBOLSO EN STRIPE
        // ============================================
        let stripeRefundId = null;
        if (stripe && order.stripe_payment_intent_id) {
            try {
                const refund = await stripe.refunds.create({
                    payment_intent: order.stripe_payment_intent_id,
                    reason: 'requested_by_customer'
                });
                stripeRefundId = refund.id;
                console.log('💰 Reembolso Stripe exitoso:', refund.id);
            } catch (stripeError) {
                console.error('Error Stripe:', stripeError);
                // Continuamos con la cancelación aunque falle Stripe (se puede arreglar manual)
                // O podríamos abortar. En este caso continuamos para liberar stock.
            }
        }

        // ============================================
        // 2. RESTAURAR STOCK
        // ============================================
        // Validar que order.order_items existe
        if (!order.order_items || order.order_items.length === 0) {
            throw new Error('No items found in order. Unable to restore stock.');
        }

        for (const item of order.order_items) {
            if (!item || !item.product_id || !item.quantity) {
                throw new Error(`Invalid item data in order ${orderId}`);
            }

            // Stock general RPC
            const { error: rpcError } = await authClient.rpc('increment_stock', {
                product_id_param: item.product_id,
                quantity_param: item.quantity
            });

            if (rpcError) {
                throw new Error(`Failed to increment stock via RPC for product ${item.product_id}: ${rpcError.message}`);
            }

            // Stock por talla
            if (item.size) {
                const { data: sizeStock, error: fetchError } = await authClient
                    .from('product_sizes')
                    .select('stock')
                    .eq('product_id', item.product_id)
                    .eq('size', item.size)
                    .single();

                if (fetchError) {
                    throw new Error(`Failed to fetch product size for product ${item.product_id}: ${fetchError.message}`);
                }

                if (!sizeStock) {
                    throw new Error(`Product size not found for product ${item.product_id} and size ${item.size}`);
                }

                const { error: updateError } = await authClient
                    .from('product_sizes')
                    .update({ stock: sizeStock.stock + item.quantity })
                    .eq('product_id', item.product_id)
                    .eq('size', item.size);

                if (updateError) {
                    throw new Error(`Failed to update size stock for product ${item.product_id}: ${updateError.message}`);
                }
            }
        }

        // ============================================
        // 3. ACTUALIZAR ESTADO PEDIDO
        // ============================================
        const { error: updateError } = await authClient
            .from('orders')
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (updateError) throw updateError;

        // ============================================
        // EMAIL 2: CANCELACIÓN COMPLETADA
        // ============================================
        if (resend) {
            try {
                await resend.emails.send({
                    from: 'Vantage <onboarding@resend.dev>',
                    to: order.customer_email,
                    subject: `✅ Pedido Cancelado - #${orderId}`,
                    html: getCancelledEmailHtml(order.customer_name, orderId.toString(), order.total, order.order_items)
                });
                console.log('📧 Email "Cancelado" enviado al cliente');
            } catch (e) {
                console.error('Error enviando email cancelado:', e);
            }
        }

        // ============================================
        // EMAIL 3: NOTIFICACIÓN AL ADMINISTRADOR
        // (Con retardo para evitar límites de Resend)
        // ============================================
        // Enviar notificación al admin de forma asíncrona con retardo
        setTimeout(async () => {
            try {
                const { sendCancelledOrderAdminAlert } = await import('../../../lib/email');

                const adminAlertSent = await sendCancelledOrderAdminAlert({
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

                if (adminAlertSent) {
                    console.log('📧 Email de alerta al administrador enviado correctamente');
                } else {
                    console.warn('⚠️ Fallo al enviar email al administrador pero la cancelación fue procesada');
                }
            } catch (emailError) {
                console.error('❌ Error enviando alerta al admin:', emailError);
                // No bloqueamos la respuesta al cliente si falla el email al admin
            }
        }, 2000); // Retardo de 2 segundos para evitar límites de Resend

        return new Response(JSON.stringify({
            success: true,
            message: 'Pedido cancelado y reembolsado correctamente. El administrador ha sido notificado.'
        }), { status: 200 });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Cancel order error:', errorMessage);

        // Log detallado del error
        if (error instanceof Error) {
            console.error('Error stack:', error.stack);
        }

        return new Response(JSON.stringify({
            success: false,
            error: errorMessage || 'Error interno del servidor'
        }), { status: 500 });
    }
};

// --- TEMPLATES DE EMAIL ---

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

function getCancelledEmailHtml(name: string, orderId: string, amount: number, items?: any[]): string {
    const formattedAmount = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount / 100);

    const itemsHtml = items && items.length > 0 ? items.map(item => {
        const hasImage = item.product_image && item.product_image.startsWith('http');
        return `
        <div style="display: flex; align-items: center; margin-bottom: 10px; padding: 10px; background: #fef2f2; border-radius: 8px;">
            ${hasImage ? `<img src="${item.product_image}" alt="${item.product_name}" width="50" height="62" style="border-radius: 6px; object-fit: cover; margin-right: 12px; opacity: 0.9;" />` : ''}
            <div>
                <span style="color: #1f2937;">${item.product_name}</span>
                ${item.size ? `<span style="color: #6b7280;"> (${item.size})</span>` : ''}
                <span style="color: #6b7280;"> × ${item.quantity}</span>
            </div>
        </div>
    `;
    }).join('') : '';

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
                
                ${itemsHtml ? `
                <div style="margin: 25px 0;">
                    <p style="font-weight: 600; color: #1f2937; margin-bottom: 12px;">Productos cancelados:</p>
                    ${itemsHtml}
                </div>
                ` : ''}
                
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
