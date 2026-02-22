import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase, validateCoupon } from '../../lib/supabase';

const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const OPTIONS: APIRoute = async () => {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
};

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

        // coupon_code es opcional (nuevo campo — el web lo envía, Flutter puede no enviarlo)
        const coupon_code: string = body.coupon_code || '';

        if (!items || !Array.isArray(items) || items.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No hay productos en el carrito' }),
                {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders,
                    },
                }
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

        // Calcular subtotal verificado desde precios de BD ANTES de validar el cupón
        // (evita bypass del mínimo de compra enviando un subtotal inflado desde el cliente)
        const verifiedSubtotal = items.reduce(
            (sum: number, item: any) => sum + (priceMap.get(Number(item.id)) ?? item.price) * item.quantity, 0
        );

        // ============================================================
        // VALIDAR COSTE DE ENVÍO DESDE BD
        // ============================================================
        let validatedShippingCost = 0;
        if (shipping_method_id) {
            const { data: shippingMethod } = await supabase
                .from('shipping_methods')
                .select('cost')
                .eq('id', Number(shipping_method_id))
                .eq('is_active', true)
                .single();

            if (shippingMethod) {
                validatedShippingCost = shippingMethod.cost;
            } else {
                return new Response(
                    JSON.stringify({ error: 'Método de envío no disponible. Por favor, recarga la página.' }),
                    { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
                );
            }
        } else {
            validatedShippingCost = shipping_cost || 0;
        }

        // ============================================================
        // VALIDAR DESCUENTO: requiere cupón válido desde BD
        // Si se envía coupon_code → validar server-side
        // Si no hay coupon_code → descuento = 0 (ignora valor del cliente)
        // ============================================================
        let validatedDiscount = 0;
        if (coupon_code) {
            const couponResult = await validateCoupon(
                coupon_code,
                verifiedSubtotal,
                customer_email || ''
            );
            if (couponResult.valid) {
                validatedDiscount = couponResult.discount;
            } else {
            }
        } else if (discount && discount > 0) {
            // Backward compat para clientes que aún no envían coupon_code (e.g. Flutter)
            // Se limita al 50% del subtotal como cota de seguridad
            const maxAllowedDiscount = Math.floor(verifiedSubtotal * 0.5);
            validatedDiscount = Math.min(discount, maxAllowedDiscount);
            if (validatedDiscount !== discount) {
            }
        }

        // Convertir items del carrito a line_items de Stripe (precio validado desde BD)
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: any) => ({
            price_data: {
                currency: 'eur',
                product_data: {
                    name: item.name,
                    images: item.image ? [item.image] : [],
                    description: item.size ? `Talla: ${item.size}` : undefined,
                },
                // Usar precio de BD si disponible; si no, precio cliente con aviso
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
                // Continuar sin el cupón si falla
            }
        }

        // Preparar datos del pedido para guardar en metadata
        // (con precios validados desde BD)
        const simplifiedItems = items.map((item: any) => ({
            id: item.id,
            name: item.name,
            price: priceMap.get(Number(item.id)) ?? item.price, // Precio validado desde BD
            quantity: item.quantity,
            size: item.size || null,
            // image omitted: Stripe metadata limit is 500 chars per value
        }));

        const verifiedTotal = verifiedSubtotal + validatedShippingCost - validatedDiscount;

        const orderData = {
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

        // Crear Checkout Session
        const sessionConfig: Stripe.Checkout.SessionCreateParams = {
            payment_method_types: ['card'],
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
        };

        // Añadir descuento si existe cupón
        if (stripeCouponId) {
            sessionConfig.discounts = [{ coupon: stripeCouponId }];
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        return new Response(
            JSON.stringify({
                sessionId: session.id,
                url: session.url
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                },
            }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                },
            }
        );
    }
};
