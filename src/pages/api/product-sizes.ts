import type { APIRoute } from 'astro';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const GET: APIRoute = async ({ url }) => {
    if (!isSupabaseConfigured) {
        return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const productId = url.searchParams.get('productId');

    if (!productId) {
        return new Response(JSON.stringify({ error: 'Product ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { data, error } = await supabase
            .from('product_sizes')
            .select('size, stock')
            .eq('product_id', parseInt(productId))
            .order('size');

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify(data || []), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
