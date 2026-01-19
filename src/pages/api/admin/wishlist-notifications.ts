import type { APIRoute } from 'astro';
import {
    getWishlistLowStockNotifications,
    markWishlistNotified,
    isSupabaseConfigured
} from '../../../lib/supabase';
import { sendWishlistLowStockEmail } from '../../../lib/email';

export const prerender = false;

// Este endpoint debe ser llamado por un cron job o manualmente desde el admin
// GET para probar, POST para ejecutar
export const POST: APIRoute = async ({ request }) => {
    if (!isSupabaseConfigured) {
        return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        // Verificar API key de admin (opcional, para seguridad)
        const authHeader = request.headers.get('Authorization');
        const adminKey = import.meta.env.ADMIN_API_KEY;

        if (adminKey && authHeader !== `Bearer ${adminKey}`) {
            // Si hay API key configurada y no coincide, rechazar
            // Si no hay API key configurada, permitir (para desarrollo)
            if (adminKey) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        // Obtener productos de wishlist con stock bajo
        const notifications = await getWishlistLowStockNotifications(9);

        if (notifications.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: 'No hay notificaciones pendientes',
                sentCount: 0
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
        const sentIds: number[] = [];
        const errors: string[] = [];

        // Agrupar por usuario para no spamear
        const userNotifications = new Map<string, typeof notifications>();

        for (const notif of notifications) {
            const existing = userNotifications.get(notif.user_email) || [];
            existing.push(notif);
            userNotifications.set(notif.user_email, existing);
        }

        // Enviar emails (solo el más urgente por usuario para no spamear)
        for (const [email, userNotifs] of userNotifications) {
            // Tomar el de menor stock primero
            const primaryNotif = userNotifs.sort((a, b) => a.size_stock - b.size_stock)[0];

            try {
                const success = await sendWishlistLowStockEmail({
                    customerEmail: primaryNotif.user_email,
                    customerName: primaryNotif.user_name || 'Cliente',
                    productName: primaryNotif.product_name,
                    productSlug: primaryNotif.product_slug,
                    productImage: primaryNotif.product_image,
                    productPrice: primaryNotif.product_price,
                    size: primaryNotif.size,
                    stockLeft: primaryNotif.size_stock,
                    baseUrl: siteUrl
                });

                if (success) {
                    // Marcar todos los items de este usuario como notificados
                    sentIds.push(...userNotifs.map(n => n.wishlist_id));
                } else {
                    errors.push(`Failed to send to ${email}`);
                }
            } catch (e) {
                errors.push(`Error sending to ${email}: ${e}`);
            }
        }

        // Marcar como notificados
        if (sentIds.length > 0) {
            await markWishlistNotified(sentIds);
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Enviadas ${userNotifications.size} notificaciones`,
            sentCount: userNotifications.size,
            markedCount: sentIds.length,
            errors: errors.length > 0 ? errors : undefined
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error('Error processing wishlist notifications:', e);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

// GET para probar/ver estado
export const GET: APIRoute = async () => {
    if (!isSupabaseConfigured) {
        return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const notifications = await getWishlistLowStockNotifications(9);

        return new Response(JSON.stringify({
            pendingNotifications: notifications.length,
            notifications: notifications.slice(0, 10) // Solo mostrar primeras 10
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e) {
        console.error('Error getting wishlist notifications:', e);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
