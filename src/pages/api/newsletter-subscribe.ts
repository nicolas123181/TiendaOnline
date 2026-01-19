import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Código promocional para nuevos suscriptores
const WELCOME_PROMO_CODE = 'BIENVENIDO10';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { email, name } = await request.json();

        if (!email) {
            return new Response(JSON.stringify({
                success: false,
                error: 'El email es requerido'
            }), { status: 400 });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Email inválido'
            }), { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Verificar si ya está suscrito
        const { data: existing } = await supabase
            .from('newsletter_subscribers')
            .select('id, subscribed')
            .eq('email', email.toLowerCase())
            .single();

        if (existing) {
            if (existing.subscribed) {
                return new Response(JSON.stringify({
                    success: true,
                    alreadySubscribed: true,
                    message: 'Ya estás suscrito a nuestra newsletter',
                    promoCode: WELCOME_PROMO_CODE // Dar el código igualmente
                }), { status: 200 });
            } else {
                // Re-suscribir
                await supabase
                    .from('newsletter_subscribers')
                    .update({ subscribed: true, updated_at: new Date().toISOString() })
                    .eq('id', existing.id);
            }
        } else {
            // Nueva suscripción
            const { error: insertError } = await supabase
                .from('newsletter_subscribers')
                .insert({
                    email: email.toLowerCase(),
                    name: name || null,
                    subscribed: true,
                    source: 'popup'
                });

            if (insertError) {
                console.error('Error inserting subscriber:', insertError);
                throw new Error('Error al guardar la suscripción');
            }
        }

        return new Response(JSON.stringify({
            success: true,
            message: '¡Gracias por suscribirte!',
            promoCode: WELCOME_PROMO_CODE
        }), { status: 200 });

    } catch (error) {
        console.error('Newsletter subscribe error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error al procesar la suscripción'
        }), { status: 500 });
    }
};
