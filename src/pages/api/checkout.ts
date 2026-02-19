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

        console.log('📋 Checkout data:', { email: customerEmail.replace(/(.{2}).+(@.+)/, '$1***$2'), itemCount: cartItems.length, total });

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
        // SOLO VERIFICAR STOCK (NO CREAR ORDEN) — 2 queries en vez de N+1 por item
        // La orden se crea cuando Stripe confirma el pago
        // ==========================================
        const itemIds = cartItems.map((item: any) => Number(item.id));

        // Fetch todos los productos en una sola query
        const { data: allProducts, error: bulkProductError } = await supabase
            .from('products')
            .select('id, name, stock')
            .in('id', itemIds);

        if (bulkProductError || !allProducts) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Error al verificar stock de productos.'
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        const productMap = new Map(allProducts.map((p: any) => [p.id, p]));

        // Fetch stocks por talla en una sola query
        const sizedItems = cartItems.filter((item: any) => item.size);
        const sizeMap = new Map<string, { stock: number }>();
        if (sizedItems.length > 0) {
            const { data: allSizes } = await supabase
                .from('product_sizes')
                .select('product_id, size, stock')
                .in('product_id', sizedItems.map((i: any) => Number(i.id)));
            if (allSizes) {
                for (const s of allSizes) {
                    sizeMap.set(`${s.product_id}:${s.size}`, { stock: s.stock });
                }
            }
        }

        for (const item of cartItems) {
            const product = productMap.get(Number(item.id));
            if (!product) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `Producto "${item.name}" no encontrado.`
                }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            if (product.stock < item.quantity) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `No hay suficiente stock para "${product.name}". Disponible: ${product.stock} unidades.`
                }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            if (item.size) {
                const sizeData = sizeMap.get(`${item.id}:${item.size}`);
                if (!sizeData) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: `La talla ${item.size} de "${item.name}" no está disponible.`
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                if (sizeData.stock < item.quantity) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: `No hay suficiente stock en talla ${item.size} para "${item.name}". Disponible: ${sizeData.stock} unidades.`
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                console.log(`✅ Stock por talla OK: ${item.name} (${item.size}) → ${sizeData.stock} disponibles`);
            }

            console.log(`✅ Stock OK para ${product.name}: ${product.stock} disponibles`);
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
