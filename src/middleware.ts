import { defineMiddleware } from 'astro:middleware';
import { supabase, isSupabaseConfigured } from './lib/supabase';

export const onRequest = defineMiddleware(async (context, next) => {
    const isApiRoute = context.url.pathname.startsWith('/api');
    const isAdminApiRoute = context.url.pathname.startsWith('/api/admin');
    const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-DNS-Prefetch-Control': 'off',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    };
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (isApiRoute && !isAdminApiRoute && context.request.method === 'OPTIONS') {
        const preflightHeaders = {
            ...corsHeaders,
            ...securityHeaders
        };
        return new Response(null, {
            status: 204,
            headers: preflightHeaders,
        });
    }

    // Solo proteger rutas /admin (excepto login)
    const isAdminRoute = context.url.pathname.startsWith('/admin');
    const isLoginPage = context.url.pathname === '/admin/login';

    if (isAdminRoute && !isLoginPage) {
        // Si Supabase no está configurado, permitir acceso (modo desarrollo)
        if (!isSupabaseConfigured) {
            console.warn('Supabase not configured - admin routes unprotected');
            return next();
        }

        try {
            // Verificar cookie de sesión admin (se borra al cerrar el navegador)
            const cookies = context.request.headers.get('cookie') || '';
            const hasAdminSession = cookies.split(';').some(c => c.trim().startsWith('admin_session='));

            if (!hasAdminSession) {
                // No hay cookie de sesión admin, forzar login
                return context.redirect('/admin/login');
            }

            // Verificar sesión de Supabase
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                // No hay sesión, redirigir a login
                return context.redirect('/admin/login');
            }
        } catch (error) {
            console.error('Auth error:', error);
            // En caso de error, redirigir a login
            return context.redirect('/admin/login');
        }
    }

    const response = await next();
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(securityHeaders)) {
        headers.set(key, value);
    }

    if (isApiRoute && !isAdminApiRoute) {
        for (const [key, value] of Object.entries(corsHeaders)) {
            headers.set(key, value);
        }
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
});

