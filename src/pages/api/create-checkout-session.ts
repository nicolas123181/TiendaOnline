import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const {
            items,
            customer_email,
            customer_name,
            customer_address,
            customer_city,
            customer_postal_code,
            customer_phone,
            shipping_method_id,
            shipping_cost,
            subtotal,
            discount,
            total,
            successUrl,
            cancelUrl
        } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No hay productos en el carrito' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Convertir items del carrito a line_items de Stripe
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: any) => ({
            price_data: {
                currency: 'eur',
                product_data: {
                    name: item.name,
                    images: item.image ? [item.image] : [],
                    description: item.size ? `Talla: ${item.size}` : undefined,
                },
                unit_amount: item.price,
            },
            quantity: item.quantity,
        }));

        // Agregar costo de envío como line item
        if (shipping_cost > 0) {
            lineItems.push({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'Envío',
                    },
                    unit_amount: shipping_cost,
                },
                quantity: 1,
            });
        }

        // Preparar datos del pedido para guardar en metadata
        // Stripe metadata tiene límite de 500 caracteres por valor
        // Así que simplificamos los items
        const simplifiedItems = items.map((item: any) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            size: item.size || null,
        }));

        const orderData = {
            customerName: customer_name,
            customerEmail: customer_email,
            customerPhone: customer_phone || '',
            customerAddress: customer_address,
            customerCity: customer_city,
            customerPostalCode: customer_postal_code,
            shippingMethodId: shipping_method_id || 0,
            cartItems: simplifiedItems,
            total: total || (subtotal + shipping_cost - (discount || 0)),
            shipping: shipping_cost || 0,
            subtotal: subtotal || 0,
            discount: discount || 0,
        };

        // Crear Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'paypal'],
            line_items: lineItems,
            mode: 'payment',
            success_url: successUrl || `${new URL(request.url).origin}/checkout/exito?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${new URL(request.url).origin}/checkout`,
            customer_email: customer_email,
            locale: 'es',
            metadata: {
                customer_name,
                orderData: JSON.stringify(orderData),
            },
            billing_address_collection: 'auto',
            phone_number_collection: {
                enabled: true,
            },
        });

        return new Response(
            JSON.stringify({
                sessionId: session.id,
                url: session.url
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Stripe Checkout error:', error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
