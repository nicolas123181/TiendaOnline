import { isSupabaseConfigured } from './supabase';
import { createClient } from '@supabase/supabase-js';

/**
 * Verifica si una request tiene autorización admin válida.
 *
 * Acepta dos mecanismos:
 *   1. Bearer token ADMIN_API_KEY  → para GitHub Actions / cron / apps externas
 *   2. Cookie admin_session activa → para el panel web del navegador
 *
 * Este helper centraliza la verificación que antes estaba dispersa (o ausente)
 * en cada endpoint de /api/admin/*.
 */
export async function verifyAdminRequest(request: Request): Promise<boolean> {
    // ── 1. Bearer token (workflows, cron, apps externas) ──────────────────────
    const adminKey = import.meta.env.ADMIN_API_KEY;
    const authHeader = request.headers.get('Authorization');

    if (adminKey && authHeader === `Bearer ${adminKey}`) {
        return true;
    }

    // ── 2. Cookie admin_session (panel web del navegador) ─────────────────────
    const cookieHeader = request.headers.get('cookie') || '';
    const hasAdminSession = cookieHeader
        .split(';')
        .some(c => c.trim().startsWith('admin_session='));

    if (!hasAdminSession) {
        return false;
    }

    // Si Supabase no está configurado, permitir en desarrollo
    if (!isSupabaseConfigured) {
        return true;
    }

    // Verificar sesión usando cliente per-request (no el singleton global que
    // comparte estado entre peticiones SSR concurrentes)
    try {
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';
        const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';

        const parseCookie = (name: string): string | undefined => {
            const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`));
            return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined;
        };

        const accessToken = parseCookie('sb-access-token');
        const refreshToken = parseCookie('sb-refresh-token');

        if (!accessToken || !refreshToken) return false;

        const serverClient = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        await serverClient.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        const { data: { session } } = await serverClient.auth.getSession();
        return !!session;
    } catch {
        return false;
    }
}

/**
 * Respuesta 401 estándar para requests no autorizadas.
 */
export function unauthorizedResponse(): Response {
    return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}
