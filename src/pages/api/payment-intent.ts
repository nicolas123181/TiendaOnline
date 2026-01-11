import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

export const POST: APIRoute = async ({ request }) => {
    try {
        const { amount, email, orderId } = await request.json();

        if (!amount || !email) {
            return new Response(
                JSON.stringify({ error: 'Faltan datos requeridos' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Crear PaymentIntent con soporte para múltiples métodos de pago
        // NOTA: En test mode, solo card y paypal funcionan correctamente
        // apple_pay y google_pay requieren certificados SSL y configuración adicional
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'eur',
            payment_method_types: ['card', 'paypal'],
            receipt_email: email,
            metadata: {
                orderId: orderId.toString(),
                email: email,
            },
        });

        return new Response(
            JSON.stringify({
                clientSecret: paymentIntent.client_secret,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Stripe error:', error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
