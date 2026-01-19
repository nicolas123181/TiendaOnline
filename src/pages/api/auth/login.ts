import type { APIRoute } from 'astro';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

export const prerender = false;

// POST - Login con email/password
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    if (!isSupabaseConfigured) {
        return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await request.json();
        const { email, password, returnTo } = body;

        if (!email || !password) {
            return new Response(JSON.stringify({
                error: 'Email y contraseña son requeridos'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            // Traducir errores comunes
            let errorMessage = error.message;
            if (error.message.includes('Invalid login credentials')) {
                errorMessage = 'Email o contraseña incorrectos';
            } else if (error.message.includes('Email not confirmed')) {
                errorMessage = 'Por favor confirma tu email antes de iniciar sesión';
            }

            return new Response(JSON.stringify({ error: errorMessage }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!data.session) {
            return new Response(JSON.stringify({
                error: 'No se pudo crear la sesión'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Setear cookies de sesión
        const { access_token, refresh_token } = data.session;

        // Cookies con opciones de seguridad
        const cookieOptions = {
            path: '/',
            httpOnly: true,
            secure: import.meta.env.PROD,
            sameSite: 'lax' as const,
            maxAge: 60 * 60 * 24 * 7, // 7 días
        };

        cookies.set('sb-access-token', access_token, cookieOptions);
        cookies.set('sb-refresh-token', refresh_token, cookieOptions);

        return new Response(JSON.stringify({
            success: true,
            user: {
                id: data.user?.id,
                email: data.user?.email,
                name: data.user?.user_metadata?.name || data.user?.user_metadata?.full_name
            },
            redirectTo: returnTo || '/perfil'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error('Login error:', e);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
