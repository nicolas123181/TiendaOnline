import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase, getServiceSupabase } from '../../lib/supabase';
import {
    sendOrderConfirmationEmail,
    sendNewOrderAdminAlert,
    sendLowStockAlert,
    sendOutOfStockAlert,
    LOW_STOCK_THRESHOLD,
    type LowStockProduct,
    type OutOfStockProduct,
    SITE_URL
} from '../../lib/email';
import { createInvoice, type InvoiceItem } from '../../lib/invoice';

const STRIPE_API_VERSION = '2023-10-16' as const;
const stripeClient = import.meta.env.STRIPE_SECRET_KEY
    ? new Stripe(import.meta.env.STRIPE_SECRET_KEY as string, { apiVersion: STRIPE_API_VERSION })
    : null;

// Helper para añadir delay entre emails y evitar rate limiting de Resend
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Convierte una URL de imagen a una URL pública absoluta
 */
function getPublicImageUrl(imageUrl: string | null | undefined): string | undefined {
    if (!imageUrl) return undefined;

    // Si ya es una URL absoluta (http:// o https://), retornarla tal cual
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }

    // Obtener la URL base de Supabase desde las variables de entorno
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;

    // Si la URL comienza con /storage/v1/object/public/, es una URL relativa de Supabase Storage
    if (imageUrl.startsWith('/storage/v1/object/public/')) {
        return supabaseUrl ? `${supabaseUrl}${imageUrl}` : imageUrl;
    }

    // Si empieza con /, es una ruta relativa del sitio
    if (imageUrl.startsWith('/')) {
        return `${SITE_URL}${imageUrl}`;
    }

    // Si no tiene protocolo pero parece ser un path de bucket (products/xxx.jpg)
    if (imageUrl.includes('/')) {
        return supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/${imageUrl}` : imageUrl;
    }

    // Fallback: retornar la URL original
    return imageUrl;
}

/**
 * API para confirmar el pago y CREAR el pedido
 * Se llama cuando Stripe confirma que el pago fue exitoso
 * 
 * POST /api/confirm-payment
 * Body: { orderData: {...}, paymentIntentId: string }
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { orderData, paymentIntentId } = body;

        console.log(`💳 Payment confirmed, creating order...`);

        if (!orderData) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Order data required'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // ==========================================
        // VERIFICACIÓN CON STRIPE: confirmar que el PaymentIntent realmente fue cobrado
        // Sin esto, cualquier cliente podía forjar un pedido en estado 'paid'
        // ==========================================
        if (!paymentIntentId) {
            console.error('❌ No paymentIntentId provided — rejecting request for security');
            return new Response(JSON.stringify({
                success: false,
                error: 'Se requiere el identificador de pago'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        try {
            if (!stripeClient) {
                throw new Error('STRIPE_SECRET_KEY not configured');
            }
            const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);

            if (paymentIntent.status !== 'succeeded') {
                console.error(`❌ PaymentIntent ${paymentIntentId} status is '${paymentIntent.status}', not 'succeeded'`);
                return new Response(JSON.stringify({
                    success: false,
                    error: 'El pago no fue completado correctamente'
                }), { status: 402, headers: { 'Content-Type': 'application/json' } });
            }

            console.log(`✅ Stripe verified: PaymentIntent ${paymentIntentId} succeeded`);
        } catch (stripeError) {
            console.error('❌ Error verifying PaymentIntent with Stripe:', stripeError);
            return new Response(JSON.stringify({
                success: false,
                error: 'No se pudo verificar el pago. Por favor, contacta con soporte.'
            }), { status: 402, headers: { 'Content-Type': 'application/json' } });
        }

        const {
            customerName,
            customerEmail,
            customerPhone,
            customerAddress,
            customerCity,
            customerPostalCode,
            shippingMethodId,
            cartItems,
            total,
            shipping,
            subtotal,
            discount
        } = orderData;

        // Usar service role para bypasear RLS (esta operación es server-side de confianza)
        let db;
        try {
            db = getServiceSupabase();
        } catch (e) {
            // Fallback al cliente anónimo si service role no está configurado
            console.warn('⚠️ Service role not configured, falling back to anonymous client');
            db = supabase;
        }

        // ==========================================
        // IDEMPOTENCIA: Verificar si ya existe un pedido con este paymentIntentId
        // Evita crear pedidos duplicados al refrescar la página de éxito
        // ==========================================
        const { data: existingOrder } = await db
            .from('orders')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .maybeSingle();

        if (existingOrder) {
            console.log(`⚠️ Order already exists for payment ${paymentIntentId}: #${existingOrder.id}`);
            return new Response(JSON.stringify({
                success: true,
                message: 'Pedido ya existente',
                orderId: existingOrder.id,
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // ==========================================
        // CREAR LA ORDEN (ya pagada)
        // ==========================================
        console.log('📝 Creating order with status: paid...');

        const { data: order, error: orderError } = await db
            .from('orders')
            .insert({
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone || null,
                customer_address: customerAddress,
                customer_city: customerCity,
                customer_postal_code: customerPostalCode,
                status: 'paid',
                total: total,
                shipping_method_id: shippingMethodId || null, // CRÍTICO: necesario para detectar recogida en tienda
                shipping_cost: shipping || 0,
                stripe_payment_intent_id: paymentIntentId,
            })
            .select()
            .single();

        if (orderError || !order) {
            // Si el error es por duplicado (constraint unique), intentar recuperar el pedido existente
            if (orderError?.code === '23505' && paymentIntentId) {
                console.log(`⚠️ Duplicate insert detected for payment ${paymentIntentId}, fetching existing order...`);
                const { data: existingOrder } = await db
                    .from('orders')
                    .select('id')
                    .eq('stripe_payment_intent_id', paymentIntentId)
                    .maybeSingle();

                if (existingOrder) {
                    return new Response(JSON.stringify({
                        success: true,
                        message: 'Pedido ya existente',
                        orderId: existingOrder.id,
                    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                }
            }

            console.error('❌ Error creating order:', orderError);
            return new Response(JSON.stringify({
                success: false,
                error: 'Error al crear el pedido: ' + (orderError?.message || 'Unknown error')
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        console.log(`✅ Order created: #${order.id}`);

        // ==========================================
        // CREAR ORDER ITEMS
        // ==========================================
        const orderItems = cartItems.map((item: any) => ({
            order_id: order.id,
            product_id: item.id,
            product_name: item.name,
            product_price: item.price,
            quantity: item.quantity,
            size: item.size || null,
        }));

        const { error: itemsError } = await db
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            console.error('❌ Error creating order items:', itemsError);
        } else {
            console.log(`✅ Order items created: ${orderItems.length} items`);
        }

        // ==========================================
        // CREAR FACTURA
        // ==========================================
        console.log(`🧾 Creating invoice for order #${order.id}...`);
        let invoiceData = null;
        try {
            const invoiceItems: InvoiceItem[] = cartItems.map((item: any) => ({
                productId: item.id,
                productName: item.name,
                productSize: item.size || undefined,
                quantity: item.quantity,
                unitPrice: item.price
            }));

            const invoice = await createInvoice({
                orderId: order.id,
                customerName: customerName,
                customerEmail: customerEmail,
                customerAddress: customerAddress,
                customerCity: customerCity,
                customerPostalCode: customerPostalCode,
                customerPhone: customerPhone,
                items: invoiceItems,
                subtotal: subtotal,
                shippingCost: shipping,
                discount: discount || 0,
                paymentMethod: 'Tarjeta de crédito (Stripe)'
            });

            if (invoice) {
                console.log(`✅ Invoice created: ${invoice.invoice_number}`);
                invoiceData = invoice;
            } else {
                console.warn('⚠️ Invoice creation returned null');
            }
        } catch (invoiceError) {
            console.error('❌ Error creating invoice:', invoiceError);
            // No fallamos el proceso si la factura no se crea
        }

        // ==========================================
        // DECREMENTAR STOCK (con soporte para tallas)
        // ==========================================
        const lowStockProducts: LowStockProduct[] = [];
        const outOfStockProducts: OutOfStockProduct[] = [];

        console.log(`📦 Processing ${cartItems.length} items for stock decrement`);

        for (const item of cartItems) {
            console.log(`📦 Processing item: ${item.name} (ID: ${item.id}), Size: ${item.size || 'N/A'}, Qty: ${item.quantity}`);

            // Obtener información del producto
            const { data: product, error: productError } = await db
                .from('products')
                .select('id, name, stock, slug, images')
                .eq('id', item.id)
                .single();

            if (productError || !product) {
                console.error(`❌ Product not found: ${item.id}, error:`, productError?.message);
                continue;
            }

            console.log(`📦 Product found: ${product.name}, current stock: ${product.stock}`);
            const productImage = product.images?.[0] || null;

            // Si el item tiene talla, decrementar stock de la talla específica
            if (item.size) {
                console.log(`📏 Looking for size ${item.size} for product ${product.name} (ID: ${item.id})`);

                // Obtener stock actual de la talla
                const { data: sizeData, error: sizeError } = await db
                    .from('product_sizes')
                    .select('id, stock')
                    .eq('product_id', item.id)
                    .eq('size', item.size)
                    .single();

                if (sizeError) {
                    console.error(`❌ Error fetching size data:`, sizeError.message, sizeError.details);
                }

                if (sizeError || !sizeData) {
                    console.warn(`⚠️ Size ${item.size} not found for product ${item.id}, falling back to product stock`);

                    const { data: updatedProductRows, error: productUpdateError } = await db
                        .from('products')
                        .update({ stock: product.stock - item.quantity, updated_at: new Date().toISOString() })
                        .eq('id', item.id)
                        .gte('stock', item.quantity)
                        .select('id');

                    if (productUpdateError) {
                        console.error(`❌ Error updating product stock:`, productUpdateError.message);
                    } else if (!updatedProductRows || updatedProductRows.length === 0) {
                        console.warn(`⚠️ Race condition: stock for ${product.name} claimed concurrently (oversell prevented)`);
                    } else {
                        console.log(`✅ Product stock updated (fallback): ${product.stock} → ${product.stock - item.quantity}`);
                    }
                } else {
                    // Decrementar stock de la talla específica (actualización condicional)
                    console.log(`📏 Size found: ID ${sizeData.id}, current stock: ${sizeData.stock}`);
                    const newSizeStock = sizeData.stock - item.quantity;
                    console.log(`📏 Updating size stock: ${sizeData.stock} -> ${newSizeStock}`);

                    const { data: updatedSizeRows, error: updateError } = await db
                        .from('product_sizes')
                        .update({ stock: newSizeStock })
                        .eq('id', sizeData.id)
                        .gte('stock', item.quantity)
                        .select('id');

                    if (updateError) {
                        console.error(`❌ Error updating size stock for ${item.name} (${item.size}):`, updateError.message);
                    } else if (!updatedSizeRows || updatedSizeRows.length === 0) {
                        console.warn(`⚠️ Race condition: size stock for ${item.name} (${item.size}) claimed concurrently (oversell prevented)`);
                    } else {
                        console.log(`✅ Size stock updated for ${item.name} (${item.size}): ${sizeData.stock} -> ${newSizeStock}`);
                    }

                    // Verificar si esta TALLA específica tiene stock bajo
                    if (newSizeStock === 0) {
                        outOfStockProducts.push({
                            id: product.id,
                            name: product.name,
                            slug: product.slug,
                            image: productImage,
                            size: item.size
                        });
                    } else if (newSizeStock <= LOW_STOCK_THRESHOLD) {
                        lowStockProducts.push({
                            id: product.id,
                            name: product.name,
                            stock: newSizeStock,
                            slug: product.slug,
                            image: productImage,
                            size: item.size
                        });
                    }
                }
            } else {
                // Producto sin talla - decrementar stock general (actualización condicional)
                const newStock = product.stock - item.quantity;

                const { data: updatedRows, error: updateError } = await db
                    .from('products')
                    .update({
                        stock: newStock,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id)
                    .gte('stock', item.quantity)
                    .select('id');

                if (updateError) {
                    console.error(`❌ Error updating stock for ${item.name}:`, updateError);
                } else if (!updatedRows || updatedRows.length === 0) {
                    console.warn(`⚠️ Race condition: stock for ${item.name} claimed concurrently (oversell prevented)`);
                } else {
                    console.log(`✅ Stock updated for ${item.name}: ${product.stock} -> ${newStock}`);
                }

                if (newStock === 0) {
                    outOfStockProducts.push({
                        id: product.id,
                        name: product.name,
                        slug: product.slug,
                        image: productImage
                    });
                } else if (newStock <= LOW_STOCK_THRESHOLD) {
                    lowStockProducts.push({
                        id: product.id,
                        name: product.name,
                        stock: newStock,
                        slug: product.slug,
                        image: productImage
                    });
                }
            }
        }

        // ==========================================
        // DETECTAR SI ES RECOGIDA EN TIENDA
        // ==========================================
        let isPickup = false;
        if (shippingMethodId) {
            try {
                const { data: shippingMethod } = await db
                    .from('shipping_methods')
                    .select('name, cost')
                    .eq('id', shippingMethodId)
                    .single();
                if (shippingMethod) {
                    const methodName = (shippingMethod.name || '').toLowerCase();
                    isPickup = methodName.includes('recoger') || methodName.includes('tienda') || methodName.includes('pickup') || shippingMethod.cost === 0;
                }
            } catch (e) {
                console.warn('⚠️ Could not determine shipping method type:', e);
            }
        }
        console.log(`📦 Is pickup order: ${isPickup}`);

        // ==========================================
        // ENVIAR EMAIL DE CONFIRMACIÓN
        // ==========================================
        console.log(`📧 Sending confirmation email to ${customerEmail}`);
        console.log('Cart items with images:', cartItems.map((item: any) => ({
            name: item.name,
            originalImage: item.image || item.images?.[0],
            processedImage: getPublicImageUrl(item.image || item.images?.[0])
        })));
        try {
            await sendOrderConfirmationEmail({
                orderNumber: order.id.toString(),
                customerName: customerName,
                customerEmail: customerEmail,
                items: cartItems.map((item: any) => ({
                    productName: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    image: getPublicImageUrl(item.image || item.images?.[0]), // URL absoluta
                    size: item.size,
                })),
                subtotal: subtotal,
                shipping: shipping,
                total: total,
                shippingAddress: customerAddress,
                city: customerCity,
                postalCode: customerPostalCode,
                phone: customerPhone,
                isPickup: isPickup,
                invoiceNumber: invoiceData?.invoice_number,
                invoiceId: invoiceData?.id,
            });
            console.log(`✅ Confirmation email sent`);
            // Delay de 2 segundos antes del siguiente email para evitar rate limiting
            await delay(2000);
        } catch (emailError) {
            console.error('❌ Error sending confirmation email:', emailError);
        }

        // ==========================================
        // ENVIAR ALERTAS DE STOCK
        // ==========================================
        if (outOfStockProducts.length > 0) {
            try {
                await sendOutOfStockAlert(outOfStockProducts);
                console.log(`✅ Out of stock alert sent`);
                // Delay de 2 segundos antes del siguiente email
                await delay(2000);
            } catch (e) {
                console.error('❌ Error sending out of stock alert:', e);
            }
        }

        if (lowStockProducts.length > 0) {
            try {
                await sendLowStockAlert(lowStockProducts);
                console.log(`✅ Low stock alert sent`);
                // Delay de 2 segundos antes del siguiente email
                await delay(2000);
            } catch (e) {
                console.error('❌ Error sending low stock alert:', e);
            }
        }

        // ==========================================
        // ENVIAR NOTIFICACIÓN DE NUEVO PEDIDO AL ADMIN
        // ==========================================
        console.log(`📧 Sending new order alert to admin...`);
        console.log(`📧 Admin alert data:`, {
            orderId: order.id,
            customerName: customerName,
            itemCount: cartItems.length,
            total: total
        });
        try {
            const adminAlertResult = await sendNewOrderAdminAlert({
                orderId: order.id,
                customerName: customerName,
                customerEmail: customerEmail,
                total: total,
                itemCount: cartItems.length,
                items: cartItems.map((item: any) => ({
                    productName: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    image: getPublicImageUrl(item.image || item.images?.[0]), // URL absoluta
                    size: item.size,
                })),
            });
            console.log(`✅ Admin alert sent. Result:`, adminAlertResult);
        } catch (e) {
            console.error('❌ Error sending admin alert:', e);
            console.error('❌ Error details:', e instanceof Error ? e.message : 'Unknown error');
        }

        console.log(`🎉 Order #${order.id} completed successfully`);

        return new Response(JSON.stringify({
            success: true,
            message: 'Pedido creado correctamente',
            orderId: order.id,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('❌ Confirm payment error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error confirmando el pago: ' + (error as Error).message
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
