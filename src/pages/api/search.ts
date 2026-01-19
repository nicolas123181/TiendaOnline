import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

/**
 * API de Búsqueda Instantánea
 * GET /api/search?q=camiseta
 */
export const GET: APIRoute = async ({ url }) => {
    try {
        const query = url.searchParams.get('q')?.trim() || '';

        if (query.length < 2) {
            return new Response(JSON.stringify({
                success: true,
                products: []
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Búsqueda ILIKE (insensible a mayúsculas/minúsculas)
        const searchPattern = `%${query}%`;

        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, slug, images, price, sale_price, is_on_sale')
            .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
            .order('name')
            .limit(8);

        if (error) {
            console.error('Search error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: 'Error en la búsqueda'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Formatear respuesta
        const formattedProducts = products?.map(product => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            image: product.images?.[0] || '/placeholder-product.jpg',
            price: product.price,
            salePrice: product.is_on_sale ? product.sale_price : null
        })) || [];

        return new Response(JSON.stringify({
            success: true,
            products: formattedProducts,
            query
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Search error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: (error as Error).message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
