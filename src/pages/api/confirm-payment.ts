import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import {
    sendOrderConfirmationEmail,
    sendNewOrderAdminAlert,
    sendLowStockAlert,
    sendOutOfStockAlert,
    LOW_STOCK_THRESHOLD,
    type LowStockProduct,
    type OutOfStockProduct
} from '../../lib/email';

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

        // ==========================================
        // CREAR LA ORDEN (ya pagada)
        // ==========================================
        console.log('📝 Creating order with status: paid...');

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone,
                customer_address: customerAddress,
                customer_city: customerCity,
                customer_postal_code: customerPostalCode,
                shipping_method_id: shippingMethodId || null,
                status: 'paid', // Ya pagado
                total: total,
                subtotal: subtotal,
                shipping_cost: shipping,
                discount: discount,
                stripe_payment_intent_id: paymentIntentId,
            })
            .select()
            .single();

        if (orderError || !order) {
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

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            console.error('❌ Error creating order items:', itemsError);
        } else {
            console.log(`✅ Order items created: ${orderItems.length} items`);
        }

        // ==========================================
        // DECREMENTAR STOCK
        // ==========================================
        const lowStockProducts: LowStockProduct[] = [];
        const outOfStockProducts: OutOfStockProduct[] = [];

        console.log(`📦 Processing ${cartItems.length} items for stock decrement`);

        for (const item of cartItems) {
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('id, name, stock, slug')
                .eq('id', item.id)
                .single();

            if (productError || !product) {
                console.error(`⚠️ Product not found: ${item.id}, skipping stock update`);
                continue;
            }

            const newStock = Math.max(0, product.stock - item.quantity);

            const { error: updateError } = await supabase
                .from('products')
                .update({
                    stock: newStock,
                    updated_at: new Date().toISOString()
                })
                .eq('id', item.id);

            if (updateError) {
                console.error(`❌ Error updating stock for ${item.name}:`, updateError);
            } else {
                console.log(`✅ Stock updated for ${item.name}: ${product.stock} -> ${newStock}`);
            }

            if (newStock === 0) {
                outOfStockProducts.push({
                    id: product.id,
                    name: product.name,
                    slug: product.slug
                });
            } else if (newStock <= LOW_STOCK_THRESHOLD) {
                lowStockProducts.push({
                    id: product.id,
                    name: product.name,
                    stock: newStock,
                    slug: product.slug
                });
            }
        }

        // ==========================================
        // ENVIAR EMAIL DE CONFIRMACIÓN
        // ==========================================
        console.log(`📧 Sending confirmation email to ${customerEmail}`);
        try {
            await sendOrderConfirmationEmail({
                orderNumber: order.id.toString(),
                customerName: customerName,
                customerEmail: customerEmail,
                items: cartItems.map((item: any) => ({
                    productName: item.name,
                    quantity: item.quantity,
                    price: item.price,
                })),
                subtotal: subtotal,
                shipping: shipping,
                total: total,
                shippingAddress: customerAddress,
                city: customerCity,
                postalCode: customerPostalCode,
                phone: customerPhone,
            });
            console.log(`✅ Confirmation email sent`);
        } catch (emailError) {
            console.error('❌ Error sending confirmation email:', emailError);
        }

        // ==========================================
        // ENVIAR ALERTAS DE STOCK
        // ==========================================
        if (outOfStockProducts.length > 0) {
            try {
                await sendOutOfStockAlert(outOfStockProducts);
            } catch (e) {
                console.error('❌ Error sending out of stock alert:', e);
            }
        }

        if (lowStockProducts.length > 0) {
            try {
                await sendLowStockAlert(lowStockProducts);
            } catch (e) {
                console.error('❌ Error sending low stock alert:', e);
            }
        }

        // ==========================================
        // ENVIAR NOTIFICACIÓN DE NUEVO PEDIDO AL ADMIN
        // ==========================================
        console.log(`📧 Sending new order alert to admin`);
        try {
            await sendNewOrderAdminAlert({
                orderId: order.id,
                customerName: customerName,
                customerEmail: customerEmail,
                total: total,
                itemCount: cartItems.length,
            });
            console.log(`✅ Admin alert sent`);
        } catch (e) {
            console.error('❌ Error sending admin alert:', e);
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
