import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { createInvoice, getInvoiceByOrderId } from '../../../lib/invoice';

/**
 * POST /api/admin/create-invoice
 * Crea una factura para un pedido existente que no tenga factura
 * Body: { orderId: number }
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { orderId } = body;

        if (!orderId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'orderId is required'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        console.log(`🧾 Creating invoice for order #${orderId}...`);

        // Verificar si ya existe factura
        const existingInvoice = await getInvoiceByOrderId(orderId);
        if (existingInvoice) {
            return new Response(JSON.stringify({
                success: true,
                message: 'Invoice already exists',
                invoice: existingInvoice
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Obtener datos del pedido
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
                *,
                order_items(*)
            `)
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Order not found: ' + (orderError?.message || 'Unknown')
            }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // Solo crear factura para pedidos pagados
        if (order.status === 'pending' || order.status === 'cancelled') {
            return new Response(JSON.stringify({
                success: false,
                error: `Cannot create invoice for order with status: ${order.status}`
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Crear factura
        const items = order.order_items.map((item: any) => ({
            productId: item.product_id,
            productName: item.product_name,
            productSize: item.size,
            quantity: item.quantity,
            unitPrice: item.product_price
        }));

        // Calcular subtotal si no existe
        const subtotal = order.subtotal || items.reduce((sum: number, item: any) =>
            sum + (item.unitPrice * item.quantity), 0);

        const invoice = await createInvoice({
            orderId: order.id,
            customerName: order.customer_name,
            customerEmail: order.customer_email,
            customerAddress: order.customer_address,
            customerCity: order.customer_city,
            customerPostalCode: order.customer_postal_code,
            customerPhone: order.customer_phone,
            items,
            subtotal,
            shippingCost: order.shipping_cost || 0,
            discount: order.discount || 0,
            paymentMethod: 'Tarjeta de crédito'
        });

        if (!invoice) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Failed to create invoice'
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        console.log(`✅ Invoice created: ${invoice.invoice_number} for order #${orderId}`);

        return new Response(JSON.stringify({
            success: true,
            message: 'Invoice created successfully',
            invoice
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('❌ Error creating invoice:', error);
        return new Response(JSON.stringify({
            success: false,
            error: (error as Error).message
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
