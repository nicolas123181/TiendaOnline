import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../lib/supabase';

const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

/**
 * Endpoint que recibe datos del pedido via query params y redirige a Stripe Checkout.
 * Esto evita problemas de CORS ya que Flutter solo hace un redirect, no un fetch.
 * 
 * GET /api/checkout-redirect?data=BASE64_ENCODED_JSON
 */
export const GET: APIRoute = async ({ request, redirect }) => {
    try {
        const url = new URL(request.url);
        const encodedData = url.searchParams.get('data');

        if (!encodedData) {
            return new Response(
                JSON.stringify({ error: 'Missing data parameter' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Decodificar datos del pedido
        let orderData: any;
        try {
            const jsonString = atob(encodedData);
            orderData = JSON.parse(jsonString);
        } catch (e) {
            return new Response(
                JSON.stringify({ error: 'Invalid data encoding' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

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
        } = orderData;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No hay productos en el carrito' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // ============================================================
        // VALIDAR PRECIOS DESDE BD (evita manipulación desde el cliente)
        // ============================================================
        const productIds = items.map((item: any) => Number(item.id)).filter(Boolean);
        const priceMap = new Map<number, number>();

        if (productIds.length > 0) {
            const { data: dbProducts } = await supabase
                .from('products')
                .select('id, price, sale_price, is_on_sale')
                .in('id', productIds);

            if (dbProducts) {
                for (const p of dbProducts) {
                    priceMap.set(p.id, (p.is_on_sale && p.sale_price) ? p.sale_price : p.price);
                }
            }
        }

        // ============================================================
        // VALIDAR COSTE DE ENVÍO DESDE BD
        // ============================================================
        let validatedShippingCost = shipping_cost || 0;
        if (shipping_method_id) {
            const { data: shippingMethod } = await supabase
                .from('shipping_methods')
                .select('cost')
                .eq('id', Number(shipping_method_id))
                .eq('is_active', true)
                .single();

            if (shippingMethod) {
                validatedShippingCost = shippingMethod.cost;
            }
        }

        // Descuento: backward compat para Flutter (sin coupon_code)
        // Se limita al 50 % del subtotal como cota de seguridad
        const rawDiscount = discount || 0;
        const rawSubtotal = items.reduce(
            (sum: number, item: any) => sum + (priceMap.get(Number(item.id)) ?? item.price) * item.quantity, 0
        );
        const validatedDiscount = Math.min(rawDiscount, Math.floor(rawSubtotal * 0.5));

        // Convertir items del carrito a line_items de Stripe (precio validado desde BD)
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: any) => ({
            price_data: {
                currency: 'eur',
                product_data: {
                    name: item.name,
                    images: item.image ? [item.image] : [],
                    description: item.size ? `Talla: ${item.size}` : undefined,
                },
                unit_amount: priceMap.get(Number(item.id)) ?? item.price,
            },
            quantity: item.quantity,
        }));

        // Agregar costo de envío validado como line item
        if (validatedShippingCost > 0) {
            lineItems.push({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'Envío',
                    },
                    unit_amount: validatedShippingCost,
                },
                quantity: 1,
            });
        }

        // Crear cupón de Stripe si hay descuento validado
        let stripeCouponId: string | undefined;
        if (validatedDiscount > 0) {
            try {
                const coupon = await stripe.coupons.create({
                    amount_off: validatedDiscount,
                    currency: 'eur',
                    duration: 'once',
                    name: 'Descuento aplicado',
                    max_redemptions: 1,
                });
                stripeCouponId = coupon.id;
            } catch (couponError) {
                console.error('Error creating Stripe coupon:', couponError);
            }
        }

        // Preparar datos del pedido para metadata (precios validados desde BD)
        const simplifiedItems = items.map((item: any) => ({
            id: item.id,
            name: item.name,
            price: priceMap.get(Number(item.id)) ?? item.price,
            quantity: item.quantity,
            size: item.size || null,
            image: item.image || null,
        }));

        const verifiedSubtotal = simplifiedItems.reduce(
            (sum: number, item: any) => sum + item.price * item.quantity, 0
        );
        const verifiedTotal = verifiedSubtotal + validatedShippingCost - validatedDiscount;

        const metaOrderData = {
            customerName: customer_name,
            customerEmail: customer_email,
            customerPhone: customer_phone || '',
            customerAddress: customer_address,
            customerCity: customer_city,
            customerPostalCode: customer_postal_code,
            shippingMethodId: shipping_method_id || 0,
            cartItems: simplifiedItems,
            total: verifiedTotal,
            shipping: validatedShippingCost,
            subtotal: verifiedSubtotal,
            discount: validatedDiscount,
        };

        const origin = new URL(request.url).origin;
        
        // Crear Checkout Session
        const sessionConfig: Stripe.Checkout.SessionCreateParams = {
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: successUrl || `${origin}/checkout/exito?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${origin}/checkout`,
            customer_email: customer_email,
            locale: 'es',
            metadata: {
                customer_name,
                orderData: JSON.stringify(metaOrderData),
            },
            billing_address_collection: 'auto',
            phone_number_collection: {
                enabled: true,
            },
        };

        if (stripeCouponId) {
            sessionConfig.discounts = [{ coupon: stripeCouponId }];
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        if (!session.url) {
            return new Response(
                JSON.stringify({ error: 'No se pudo crear la sesión de checkout' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Redirigir directamente a Stripe Checkout
        return redirect(session.url, 302);

    } catch (error) {
        console.error('Stripe Checkout redirect error:', error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
