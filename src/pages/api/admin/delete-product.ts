import type { APIRoute } from 'astro';
import { supabase, getServiceSupabase } from '../../../lib/supabase';
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

    // Intentar usar el cliente service-role; si no está configurado,
    // usar el cliente anon (ya estamos autenticados como admin)
    let db = supabase;
    try {
        db = getServiceSupabase();
    } catch {
        // SUPABASE_SERVICE_ROLE_KEY no configurado → seguimos con cliente anon
    }

    try {
        let body: any;
        try {
            body = await request.json();
        } catch {
            return new Response(JSON.stringify({
                success: false,
                error: 'Body JSON inválido'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const { productId } = body;

        if (!productId || isNaN(Number(productId))) {
            return new Response(JSON.stringify({
                success: false,
                error: 'ID de producto inválido'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const id = Number(productId);

        // 1. Verificar que el producto existe
        const { data: product, error: fetchError } = await db
            .from('products')
            .select('id, name')
            .eq('id', id)
            .single();

        if (fetchError || !product) {
            return new Response(JSON.stringify({
                success: false,
                error: `Producto no encontrado${fetchError ? ': ' + fetchError.message : ''}`
            }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // 2. Comprobar si tiene ventas asociadas
        const { count: salesCount, error: salesError } = await db
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

        // 3. Eliminar stock por tallas (ignorar si la tabla no existe)
        await db.from('product_sizes').delete().eq('product_id', id);

        // 4. Eliminar wishlist items asociados
        await db.from('wishlist').delete().eq('product_id', id);

        // 5. Eliminar el producto
        const { error: deleteError } = await db
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
        const msg = e instanceof Error ? e.message : String(e);
        return new Response(JSON.stringify({
            success: false,
            error: `Error en el servidor: ${msg}`
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
