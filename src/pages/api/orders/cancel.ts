import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { orderId } = await request.json();

        if (!orderId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'ID del pedido requerido'
            }), { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Verificar autenticación
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No estás autenticado'
            }), { status: 401 });
        }

        // Obtener usuario
        const { data: { user } } = await supabase.auth.getUser(accessToken);
        if (!user) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Sesión inválida'
            }), { status: 401 });
        }

        // Obtener pedido con items
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
                *,
                order_items(
                    id,
                    product_id,
                    quantity,
                    size
                )
            `)
            .eq('id', orderId)
            .eq('customer_email', user.email)
            .single();

        if (orderError || !order) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Pedido no encontrado'
            }), { status: 404 });
        }

        // Verificar que el pedido está en estado "paid" (antes de envío)
        if (order.status !== 'paid') {
            const statusMessages: Record<string, string> = {
                'pending': 'El pedido aún no ha sido pagado',
                'shipped': 'El pedido ya ha sido enviado y no puede cancelarse',
                'delivered': 'El pedido ya ha sido entregado. Puedes solicitar una devolución.',
                'cancelled': 'El pedido ya está cancelado'
            };

            return new Response(JSON.stringify({
                success: false,
                error: statusMessages[order.status] || 'Este pedido no puede cancelarse'
            }), { status: 400 });
        }

        // =====================================================
        // TRANSACCIÓN ATÓMICA: Cancelar pedido + Restaurar stock
        // =====================================================

        // 1. Restaurar stock de productos
        for (const item of order.order_items) {
            // Restaurar stock general del producto
            const { error: stockError } = await supabase.rpc('increment_stock', {
                product_id_param: item.product_id,
                quantity_param: item.quantity
            });

            if (stockError) {
                console.error('Error restoring product stock:', stockError);
                // Intentar con update directo si RPC no existe
                await supabase
                    .from('products')
                    .update({ stock: supabase.rpc('add', { a: 'stock', b: item.quantity }) })
                    .eq('id', item.product_id);
            }

            // Restaurar stock por talla si aplica
            if (item.size) {
                const { error: sizeStockError } = await supabase
                    .from('product_sizes')
                    .select('stock')
                    .eq('product_id', item.product_id)
                    .eq('size', item.size)
                    .single();

                if (!sizeStockError) {
                    await supabase
                        .from('product_sizes')
                        .update({
                            stock: supabase.rpc('add', { a: 'stock', b: item.quantity })
                        })
                        .eq('product_id', item.product_id)
                        .eq('size', item.size);
                }
            }
        }

        // 2. Restaurar stock directamente (método alternativo más confiable)
        for (const item of order.order_items) {
            // Obtener stock actual del producto
            const { data: product } = await supabase
                .from('products')
                .select('stock')
                .eq('id', item.product_id)
                .single();

            if (product) {
                await supabase
                    .from('products')
                    .update({ stock: product.stock + item.quantity })
                    .eq('id', item.product_id);
            }

            // Restaurar stock por talla
            if (item.size) {
                const { data: sizeStock } = await supabase
                    .from('product_sizes')
                    .select('stock')
                    .eq('product_id', item.product_id)
                    .eq('size', item.size)
                    .single();

                if (sizeStock) {
                    await supabase
                        .from('product_sizes')
                        .update({ stock: sizeStock.stock + item.quantity })
                        .eq('product_id', item.product_id)
                        .eq('size', item.size);
                }
            }
        }

        // 3. Cambiar estado del pedido a "cancelled"
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('Error updating order status:', updateError);
            return new Response(JSON.stringify({
                success: false,
                error: 'Error al cancelar el pedido'
            }), { status: 500 });
        }

        console.log(`✅ Order ${orderId} cancelled. Stock restored for ${order.order_items.length} items.`);

        return new Response(JSON.stringify({
            success: true,
            message: 'Pedido cancelado correctamente. El stock ha sido restaurado.'
        }), { status: 200 });

    } catch (error) {
        console.error('Cancel order error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error interno del servidor'
        }), { status: 500 });
    }
};
