import { defineMiddleware } from 'astro:middleware';
import { supabase, isSupabaseConfigured } from './lib/supabase';

export const onRequest = defineMiddleware(async (context, next) => {
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

    return next();
});

