import type { APIRoute } from 'astro';
import { supabase, isSupabaseConfigured, addToWishlist, removeFromWishlist, isInWishlist } from '../../lib/supabase';

export const prerender = false;

// GET - Verificar si producto está en wishlist
export const GET: APIRoute = async ({ url, cookies }) => {
    if (!isSupabaseConfigured) {
        return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Obtener sesión del usuario
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
        return new Response(JSON.stringify({ error: 'Not authenticated', isInWishlist: false }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Verificar sesión
    const { data: { user }, error: authError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
    });

    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid session', isInWishlist: false }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const productId = url.searchParams.get('productId');
    const size = url.searchParams.get('size');

    if (!productId || !size) {
        return new Response(JSON.stringify({ error: 'Product ID and size are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const inWishlist = await isInWishlist(user.id, parseInt(productId), size);

        return new Response(JSON.stringify({ isInWishlist: inWishlist }), {
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

// POST - Añadir a wishlist
export const POST: APIRoute = async ({ request, cookies }) => {
    if (!isSupabaseConfigured) {
        return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Obtener sesión del usuario
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
        return new Response(JSON.stringify({ error: 'Not authenticated', requiresLogin: true }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Verificar sesión
    const { data: { user }, error: authError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
    });

    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid session', requiresLogin: true }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await request.json();
        const { productId, size } = body;

        if (!productId || !size) {
            return new Response(JSON.stringify({ error: 'Product ID and size are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const success = await addToWishlist(user.id, productId, size);

        if (success) {
            return new Response(JSON.stringify({
                success: true,
                message: 'Añadido a favoritos',
                isInWishlist: true
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response(JSON.stringify({ error: 'Failed to add to wishlist' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    } catch (e) {
        console.error('Error adding to wishlist:', e);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

// DELETE - Quitar de wishlist
export const DELETE: APIRoute = async ({ url, cookies }) => {
    if (!isSupabaseConfigured) {
        return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Obtener sesión del usuario
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Verificar sesión
    const { data: { user }, error: authError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
    });

    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid session' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const productId = url.searchParams.get('productId');
    const size = url.searchParams.get('size');

    if (!productId || !size) {
        return new Response(JSON.stringify({ error: 'Product ID and size are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const success = await removeFromWishlist(user.id, parseInt(productId), size);

        if (success) {
            return new Response(JSON.stringify({
                success: true,
                message: 'Eliminado de favoritos',
                isInWishlist: false
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response(JSON.stringify({ error: 'Failed to remove from wishlist' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    } catch (e) {
        console.error('Error removing from wishlist:', e);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
