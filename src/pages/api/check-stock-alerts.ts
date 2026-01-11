import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import {
    sendLowStockAlert,
    sendOutOfStockAlert,
    LOW_STOCK_THRESHOLD,
    type LowStockProduct,
    type OutOfStockProduct
} from '../../lib/email';

/**
 * API para verificar el inventario y enviar alertas de stock
 * POST /api/check-stock-alerts
 * 
 * Escanea todos los productos y envía:
 * - Email de productos agotados (stock = 0)
 * - Email de productos con stock bajo (stock ≤ 5)
 */
export const POST: APIRoute = async ({ request }) => {
    console.log('🔍 Manual stock check triggered');

    try {
        // Obtener todos los productos con stock bajo o agotados
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, stock, slug')
            .lte('stock', LOW_STOCK_THRESHOLD)
            .order('stock', { ascending: true });

        if (error) {
            console.error('❌ Error fetching products:', error);
            return new Response(JSON.stringify({
                success: false,
                error: 'Error al obtener productos'
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        if (!products || products.length === 0) {
            console.log('✅ No products with low stock found');
            return new Response(JSON.stringify({
                success: true,
                message: 'No hay productos con stock bajo ni agotados',
                outOfStock: 0,
                lowStock: 0,
                emailsSent: false
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Separar productos agotados y con stock bajo
        const outOfStockProducts: OutOfStockProduct[] = [];
        const lowStockProducts: LowStockProduct[] = [];

        for (const product of products) {
            if (product.stock === 0) {
                outOfStockProducts.push({
                    id: product.id,
                    name: product.name,
                    slug: product.slug
                });
            } else {
                lowStockProducts.push({
                    id: product.id,
                    name: product.name,
                    stock: product.stock,
                    slug: product.slug
                });
            }
        }

        console.log(`📊 Stock check results: ${outOfStockProducts.length} agotados, ${lowStockProducts.length} stock bajo`);

        let outOfStockEmailSent = false;
        let lowStockEmailSent = false;

        // Enviar email de productos agotados
        if (outOfStockProducts.length > 0) {
            console.log('🚨 Sending out of stock alert...');
            try {
                outOfStockEmailSent = await sendOutOfStockAlert(outOfStockProducts);
                console.log('✅ Out of stock email sent:', outOfStockEmailSent);
            } catch (e) {
                console.error('❌ Error sending out of stock email:', e);
            }
        }

        // Enviar email de stock bajo
        if (lowStockProducts.length > 0) {
            console.log('⚠️ Sending low stock alert...');
            try {
                lowStockEmailSent = await sendLowStockAlert(lowStockProducts);
                console.log('✅ Low stock email sent:', lowStockEmailSent);
            } catch (e) {
                console.error('❌ Error sending low stock email:', e);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Verificación completada`,
            outOfStock: outOfStockProducts.length,
            lowStock: lowStockProducts.length,
            outOfStockProducts: outOfStockProducts.map(p => p.name),
            lowStockProducts: lowStockProducts.map(p => ({ name: p.name, stock: p.stock })),
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
