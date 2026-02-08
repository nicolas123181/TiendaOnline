import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const OPTIONS: APIRoute = async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
};

/**
 * API para obtener suscriptores activos del newsletter
 */
export const GET: APIRoute = async () => {
    try {
        const { data: subscribers, error } = await supabase
            .from('newsletter_subscribers')
            .select('id, email, name, is_active, subscribed_at, unsubscribed_at')
            .eq('is_active', true)
            .order('subscribed_at', { ascending: false });

        if (error) {
            console.error('Error fetching subscribers:', error);
            return new Response(JSON.stringify({
                success: false,
                error: 'Error al obtener suscriptores'
            }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({
            success: true,
            subscribers: subscribers || [],
            count: subscribers?.length || 0
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Newsletter subscribers error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: (error as Error).message
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
};
