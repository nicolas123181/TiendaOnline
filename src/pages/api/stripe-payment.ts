import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '');

export const POST: APIRoute = async (context) => {
    try {
        // Validar que tenemos la clave secreta
        if (!import.meta.env.STRIPE_SECRET_KEY) {
            return new Response(
                JSON.stringify({ error: 'Stripe no está configurado' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const body = await context.request.json();
        const { amount, email, orderId } = body;

        // Validar datos
        if (!amount || !email || !orderId) {
            return new Response(
                JSON.stringify({ error: 'Datos incompletos' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Crear payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount), // En céntimos
            currency: 'eur',
            receipt_email: email,
            metadata: {
                orderId: orderId.toString(),
            },
        });

        return new Response(
            JSON.stringify({
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Stripe Payment Intent error:', error);
        return new Response(
            JSON.stringify({
                error: 'Error al crear el pago: ' + (error as Error).message,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
