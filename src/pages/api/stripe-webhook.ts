import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getServiceSupabase } from '../../lib/supabase';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '');
const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET || '';

export const POST: APIRoute = async (context) => {
    try {
        // Validar configuración
        if (!webhookSecret) {
            console.error('STRIPE_WEBHOOK_SECRET no está configurado');
            return new Response('Webhook no configurado', { status: 500 });
        }

        const body = await context.request.text();
        const sig = context.request.headers.get('stripe-signature') || '';

        // Verificar firma del webhook
        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err);
            return new Response(
                `Webhook Error: ${err instanceof Error ? err.message : 'Unknown'}`,
                { status: 400 }
            );
        }

        // Manejar diferentes tipos de eventos
        const supabase = getServiceSupabase();

        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const orderId = paymentIntent.metadata?.orderId;

            console.log(`✅ Pago exitoso para pedido #${orderId}`);

            if (orderId) {
                try {
                    // Actualizar estado del pedido a "paid"
                    const { error } = await supabase
                        .from('orders')
                        .update({
                            status: 'paid',
                            stripe_payment_intent_id: paymentIntent.id,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', parseInt(orderId));

                    if (error) {
                        console.error('Error updating order:', error);
                        return new Response('Error updating order', { status: 500 });
                    }

                    // Aquí se podría enviar email de confirmación
                    console.log(`✉️ Email de confirmación enviado para pedido #${orderId}`);
                } catch (error) {
                    console.error('Error processing payment:', error);
                    return new Response('Error processing payment', { status: 500 });
                }
            }
        }

        if (event.type === 'payment_intent.payment_failed') {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const orderId = paymentIntent.metadata?.orderId;

            console.log(`❌ Pago fallido para pedido #${orderId}`);

            if (orderId) {
                try {
                    // Actualizar estado del pedido a "cancelled"
                    await supabase
                        .from('orders')
                        .update({
                            status: 'cancelled',
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', parseInt(orderId));

                    console.log(`🗑️ Pedido #${orderId} cancelado por fallo de pago`);
                } catch (error) {
                    console.error('Error handling payment failure:', error);
                }
            }
        }

        // Retornar confirmación al webhook
        return new Response(JSON.stringify({ received: true }), { status: 200 });
    } catch (error) {
        console.error('Webhook handler error:', error);
        return new Response('Webhook handler error', { status: 400 });
    }
};
