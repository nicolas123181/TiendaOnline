import type { APIRoute } from 'astro';
import { getServiceSupabase } from '../../../lib/supabase';
import { verifyAdminRequest, unauthorizedResponse } from '../../../lib/adminAuth';

/**
 * API para obtener la lista de suscriptores del newsletter
 * Usado por el panel de administración de Flutter
 * Usa Service Role para bypassear RLS
 */
export const GET: APIRoute = async ({ request }) => {
    if (!await verifyAdminRequest(request)) {
        return unauthorizedResponse();
    }
    try {
        const supabase = getServiceSupabase();

        const { data: subscribers, error } = await supabase
            .from('newsletter_subscribers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching newsletter subscribers:', error);
            return new Response(JSON.stringify({
                success: false,
                error: 'Error al obtener suscriptores: ' + error.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            subscribers: subscribers || []
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Newsletter subscribers error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: (error as Error).message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
