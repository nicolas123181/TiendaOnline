import type { APIRoute } from 'astro';
import { getServiceSupabase } from '../../../lib/supabase';
import { verifyAdminRequest, unauthorizedResponse } from '../../../lib/adminAuth';

/**
 * DELETE /api/admin/delete-product
 * Body: { productId: number }
 *
 * Reglas:
 *  - Solo admin (cookie admin_session o Bearer ADMIN_API_KEY)
 *  - No se puede eliminar si el producto tiene ventas en order_items
 *  - Si no tiene ventas: elimina product_sizes y luego el producto
 */
export const DELETE: APIRoute = async ({ request }) => {
    if (!await verifyAdminRequest(request)) {
        return unauthorizedResponse();
    }

    try {
        const { productId } = await request.json();

        if (!productId || isNaN(Number(productId))) {
            return new Response(JSON.stringify({
                success: false,
                error: 'ID de producto inválido'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const id = Number(productId);
        const adminDb = getServiceSupabase();

        // 1. Verificar que el producto existe
        const { data: product, error: fetchError } = await adminDb
            .from('products')
            .select('id, name')
            .eq('id', id)
            .single();

        if (fetchError || !product) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Producto no encontrado'
            }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // 2. Comprobar si tiene ventas asociadas
        const { count: salesCount, error: salesError } = await adminDb
            .from('order_items')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', id);

        if (salesError) {
            return new Response(JSON.stringify({
                success: false,
                error: `Error al comprobar ventas: ${salesError.message}`
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        if ((salesCount ?? 0) > 0) {
            return new Response(JSON.stringify({
                success: false,
                cannotDelete: true,
                salesCount,
                error: `No se puede eliminar "${product.name}" porque tiene ${salesCount} venta(s) registrada(s). Usa "Deshabilitar" para ocultarlo sin perder el historial.`
            }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }

        // 3. Eliminar stock por tallas (product_sizes) si existe la tabla
        const { error: sizesError } = await adminDb
            .from('product_sizes')
            .delete()
            .eq('product_id', id);

        // Ignorar error si la tabla no existe (columna desconocida, etc.)
        if (sizesError && !sizesError.message.includes('does not exist') && !sizesError.message.includes('relation')) {
            return new Response(JSON.stringify({
                success: false,
                error: `Error al eliminar tallas: ${sizesError.message}`
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        // 4. Eliminar wishlist items asociados (por si acaso hay FK)
        await adminDb.from('wishlist').delete().eq('product_id', id);

        // 5. Eliminar el producto
        const { error: deleteError } = await adminDb
            .from('products')
            .delete()
            .eq('id', id);

        if (deleteError) {
            return new Response(JSON.stringify({
                success: false,
                error: `Error al eliminar el producto: ${deleteError.message}`
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Producto "${product.name}" eliminado correctamente`
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (e) {
        return new Response(JSON.stringify({
            success: false,
            error: 'Error inesperado en el servidor'
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
