import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ redirect, cookies }) => {
    // Cerrar sesión en Supabase
    await supabase.auth.signOut();

    // Eliminar la cookie de sesión si existe
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });
    // Eliminar cookie de sesión admin (fuerza re-login al volver)
    cookies.delete('admin_session', { path: '/admin' });

    // Redirigir al inicio de la tienda
    return redirect('/');
};

// También permitir GET para facilitar el uso
export const GET: APIRoute = async ({ redirect, cookies }) => {
    await supabase.auth.signOut();

    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });
    cookies.delete('admin_session', { path: '/admin' });

    return redirect('/');
};
