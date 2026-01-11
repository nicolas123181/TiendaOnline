import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

/**
 * API de Checkout - Solo verifica stock
 * NO crea la orden aquí. La orden se crea cuando Stripe confirma el pago.
 */
export const POST: APIRoute = async ({ request }) => {
    console.log('📦 Checkout API called');

    try {
        const formData = await request.formData();

        // Obtener datos del formulario
        const customerName = formData.get("customer_name")?.toString() || "";
        const customerEmail = formData.get("customer_email")?.toString() || "";
        const customerPhone = formData.get("customer_phone")?.toString() || "";
        const customerAddress = formData.get("customer_address")?.toString() || "";
        const customerCity = formData.get("customer_city")?.toString() || "";
        const customerPostalCode = formData.get("customer_postal_code")?.toString() || "";
        const shippingMethodId = parseInt(formData.get("shipping_method_id")?.toString() || "0");
        const cartItems = JSON.parse(formData.get("cart_items")?.toString() || "[]");
        const total = parseInt(formData.get("total")?.toString() || "0");
        const shipping = parseInt(formData.get("shipping")?.toString() || "0");
        const subtotal = parseInt(formData.get("subtotal")?.toString() || "0");
        const discount = parseInt(formData.get("discount")?.toString() || "0");

        console.log('📋 Checkout data:', { customerName, customerEmail, itemCount: cartItems.length, total });

        // Validar datos
        if (!customerName || !customerEmail || !customerAddress || !customerCity || !customerPostalCode) {
            return new Response(JSON.stringify({
                success: false,
                error: "Por favor completa todos los campos obligatorios."
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        if (cartItems.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: "Tu carrito está vacío."
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // ==========================================
        // SOLO VERIFICAR STOCK (NO CREAR ORDEN)
        // La orden se crea cuando Stripe confirma el pago
        // ==========================================
        for (const item of cartItems) {
            console.log(`📦 Verificando stock: ${item.name} (ID: ${item.id}, Qty: ${item.quantity})`);

            const { data: currentProduct, error: fetchError } = await supabase
                .from('products')
                .select('id, name, stock')
                .eq('id', item.id)
                .single();

            if (fetchError || !currentProduct) {
                console.error(`❌ Product not found: ${item.id}`);
                return new Response(JSON.stringify({
                    success: false,
                    error: `Producto "${item.name}" no encontrado.`
                }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            if (currentProduct.stock < item.quantity) {
                console.error(`❌ Insufficient stock for ${item.name}: has ${currentProduct.stock}, needs ${item.quantity}`);
                return new Response(JSON.stringify({
                    success: false,
                    error: `No hay suficiente stock para "${item.name}". Disponible: ${currentProduct.stock} unidades.`
                }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            console.log(`✅ Stock OK para ${item.name}: ${currentProduct.stock} disponibles`);
        }

        console.log('✅ Stock verificado correctamente, listo para Stripe');

        // Devolver éxito - NO se crea orden aquí
        // Los datos del pedido se pasan a Stripe y la orden se crea al confirmar pago
        return new Response(JSON.stringify({
            success: true,
            message: 'Stock verificado correctamente',
            // Pasamos los datos para que el frontend los envíe a Stripe
            orderData: {
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
            }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('❌ Checkout error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error al procesar el pedido: ' + (error as Error).message
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
