import type { APIRoute } from 'astro';
import {
    getWishlistSaleNotifications,
    markWishlistSaleNotified,
    resetWishlistSaleNotifications,
    isSupabaseConfigured
} from '../../../lib/supabase';
import { sendWishlistSaleEmail } from '../../../lib/email';

export const prerender = false;

// Este endpoint envía notificaciones cuando productos en wishlist entran en oferta
// POST para ejecutar el envío de emails

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
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Primero resetear notificaciones de productos que ya no están en oferta
        await resetWishlistSaleNotifications();

        // Obtener productos de wishlist en oferta
        const notifications = await getWishlistSaleNotifications();

        if (notifications.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: 'No hay notificaciones de ofertas pendientes',
                sentCount: 0
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://nicovantage.victoriafp.online';
        const sentIds: number[] = [];
        const errors: string[] = [];

        // Agrupar por usuario para no spamear
        const userNotifications = new Map<string, typeof notifications>();

        for (const notif of notifications) {
            const existing = userNotifications.get(notif.user_email) || [];
            existing.push(notif);
            userNotifications.set(notif.user_email, existing);
        }

        // Enviar emails (solo el de mayor descuento por usuario para no spamear)
        for (const [email, userNotifs] of userNotifications) {
            // Tomar el de mayor descuento primero
            const primaryNotif = userNotifs.sort((a, b) => b.discount_percentage - a.discount_percentage)[0];

            try {
                const success = await sendWishlistSaleEmail({
                    customerEmail: primaryNotif.user_email,
                    customerName: primaryNotif.user_name || undefined,
                    productName: primaryNotif.product_name,
                    productSlug: primaryNotif.product_slug,
                    productImage: primaryNotif.product_image,
                    originalPrice: primaryNotif.original_price,
                    salePrice: primaryNotif.sale_price,
                    discountPercentage: primaryNotif.discount_percentage,
                    size: primaryNotif.size,
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
            await markWishlistSaleNotified(sentIds);
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Enviadas ${userNotifications.size} notificaciones de ofertas`,
            sentCount: userNotifications.size,
            markedCount: sentIds.length,
            errors: errors.length > 0 ? errors : undefined
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error('Error processing sale notifications:', e);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

// GET para ver estado de notificaciones pendientes
export const GET: APIRoute = async () => {
    if (!isSupabaseConfigured) {
        return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const notifications = await getWishlistSaleNotifications();

        return new Response(JSON.stringify({
            pendingNotifications: notifications.length,
            notifications: notifications.slice(0, 10) // Solo mostrar primeras 10
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e) {
        console.error('Error getting sale notifications:', e);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
