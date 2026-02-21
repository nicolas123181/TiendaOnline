import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import {
    sendLowStockAlert,
    sendOutOfStockAlert,
    LOW_STOCK_THRESHOLD,
    type LowStockProduct,
    type OutOfStockProduct
} from '../../lib/email';
import { verifyAdminRequest, unauthorizedResponse } from '../../lib/adminAuth';

/**
 * API para verificar el inventario y enviar alertas de stock
 * POST /api/check-stock-alerts
 * 
 * Escanea todos los productos Y TALLAS y envía:
 * - Email de productos/tallas agotados (stock = 0)
 * - Email de productos/tallas con stock bajo (stock ≤ 5)
 */
export const POST: APIRoute = async ({ request }) => {
    if (!await verifyAdminRequest(request)) {
        return unauthorizedResponse();
    }
    console.log('🔍 Manual stock check triggered (including sizes)');

    try {
        const outOfStockItems: OutOfStockProduct[] = [];
        const lowStockItems: LowStockProduct[] = [];

        // 1. Verificar stock por TALLA (product_sizes)
        const { data: sizesWithLowStock, error: sizesError } = await supabase
            .from('product_sizes')
            .select(`
                id,
                size,
                stock,
                product_id,
                products:product_id (
                    id,
                    name,
                    slug,
                    images
                )
            `)
            .lte('stock', LOW_STOCK_THRESHOLD)
            .order('stock', { ascending: true });

        if (sizesError) {
            console.error('❌ Error fetching product sizes:', sizesError);
        } else if (sizesWithLowStock && sizesWithLowStock.length > 0) {
            console.log(`📏 Found ${sizesWithLowStock.length} sizes with low stock`);

            for (const sizeItem of sizesWithLowStock) {
                const product = sizeItem.products as any;
                if (!product) continue;

                const imageUrl = product.images?.[0] || null;

                if (sizeItem.stock === 0) {
                    outOfStockItems.push({
                        id: product.id,
                        name: product.name,
                        slug: product.slug,
                        image: imageUrl,
                        size: sizeItem.size
                    });
                } else {
                    lowStockItems.push({
                        id: product.id,
                        name: product.name,
                        stock: sizeItem.stock,
                        slug: product.slug,
                        image: imageUrl,
                        size: sizeItem.size
                    });
                }
            }
        }

        // 2. También verificar productos sin tallas (stock global)
        const { data: productsWithLowStock, error: productsError } = await supabase
            .from('products')
            .select('id, name, stock, slug, images')
            .lte('stock', LOW_STOCK_THRESHOLD)
            .order('stock', { ascending: true });

        if (productsError) {
            console.error('❌ Error fetching products:', productsError);
        } else if (productsWithLowStock) {
            // Verificar si este producto ya fue añadido por las tallas
            const existingProductIds = new Set([
                ...outOfStockItems.map(p => `${p.id}`),
                ...lowStockItems.map(p => `${p.id}`)
            ]);

            for (const product of productsWithLowStock) {
                // Si no tiene tallas configuradas, usar el stock global
                const { count } = await supabase
                    .from('product_sizes')
                    .select('*', { count: 'exact', head: true })
                    .eq('product_id', product.id);

                // Solo añadir si no tiene tallas (count = 0) y no existe ya
                if (count === 0 && !existingProductIds.has(`${product.id}`)) {
                    const imageUrl = product.images?.[0] || null;

                    if (product.stock === 0) {
                        outOfStockItems.push({
                            id: product.id,
                            name: product.name,
                            slug: product.slug,
                            image: imageUrl
                        });
                    } else {
                        lowStockItems.push({
                            id: product.id,
                            name: product.name,
                            stock: product.stock,
                            slug: product.slug,
                            image: imageUrl
                        });
                    }
                }
            }
        }

        console.log(`📊 Stock check results: ${outOfStockItems.length} agotados, ${lowStockItems.length} stock bajo`);

        if (outOfStockItems.length === 0 && lowStockItems.length === 0) {
            console.log('✅ No products/sizes with low stock found');
            return new Response(JSON.stringify({
                success: true,
                message: 'No hay productos ni tallas con stock bajo ni agotados',
                outOfStock: 0,
                lowStock: 0,
                emailsSent: false
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        let outOfStockEmailSent = false;
        let lowStockEmailSent = false;

        // Enviar email de productos agotados
        if (outOfStockItems.length > 0) {
            console.log('🚨 Sending out of stock alert...');
            try {
                outOfStockEmailSent = await sendOutOfStockAlert(outOfStockItems);
                console.log('✅ Out of stock email sent:', outOfStockEmailSent);
            } catch (e) {
                console.error('❌ Error sending out of stock email:', e);
            }
        }

        // Enviar email de stock bajo
        if (lowStockItems.length > 0) {
            console.log('⚠️ Sending low stock alert...');
            try {
                lowStockEmailSent = await sendLowStockAlert(lowStockItems);
                console.log('✅ Low stock email sent:', lowStockEmailSent);
            } catch (e) {
                console.error('❌ Error sending low stock email:', e);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Verificación completada`,
            outOfStock: outOfStockItems.length,
            lowStock: lowStockItems.length,
            outOfStockItems: outOfStockItems.map(p => ({
                name: p.name,
                size: p.size || 'Sin talla'
            })),
            lowStockItems: lowStockItems.map(p => ({
                name: p.name,
                size: p.size || 'Sin talla',
                stock: p.stock
            })),
            emailsSent: {
                outOfStock: outOfStockEmailSent,
                lowStock: lowStockEmailSent
            }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('❌ Stock check error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error al verificar inventario: ' + (error as Error).message
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
