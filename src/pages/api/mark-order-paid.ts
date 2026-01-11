import type { APIRoute } from 'astro';

/**
 * @deprecated Use /api/confirm-payment instead
 * This endpoint redirects to the new confirm-payment endpoint
 */
export const POST: APIRoute = async ({ request, redirect }) => {
    // Redirect to the new endpoint
    const body = await request.json();

    const response = await fetch(new URL('/api/confirm-payment', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const result = await response.json();

    return new Response(JSON.stringify(result), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
    });
};
