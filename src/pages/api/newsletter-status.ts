import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Returns whether the logged-in user is already subscribed to the newsletter.
// Uses the Authorization bearer token from the client to identify the user.
export const GET: APIRoute = async ({ request }) => {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ subscribed: false }), { status: 200 });
        }

        const accessToken = authHeader.slice(7);

        // Use service role to validate session and query email
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
        if (userError || !user?.email) {
            return new Response(JSON.stringify({ subscribed: false }), { status: 200 });
        }

        const { data } = await supabase
            .from('newsletter_subscribers')
            .select('subscribed')
            .eq('email', user.email.toLowerCase())
            .eq('subscribed', true)
            .maybeSingle();

        return new Response(JSON.stringify({ subscribed: !!data }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ subscribed: false }), { status: 200 });
    }
};
