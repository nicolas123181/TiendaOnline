import type { APIRoute } from 'astro';
import {
    getWishlistSaleNotifications,
    markWishlistSaleNotified,
    resetWishlistSaleNotifications,
    isSupabaseConfigured
} from '../../../lib/supabase';
import { sendWishlistSaleEmail } from '../../../lib/email';
import { verifyAdminRequest, unauthorizedResponse } from '../../../lib/adminAuth';

export const prerender = false;

// Este endpoint envía notificaciones cuando productos en wishlist entran en oferta
// POST para ejecutar el envío de emails

export const POST: APIRoute = async ({ request }) => {
    if (!await verifyAdminRequest(request)) {
        return unauthorizedResponse();
    }

    if (!isSupabaseConfigured) {
        return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
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

        const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
        const sentIds: number[] = [];
        const errors: string[] = [];

        // Ordenar por descuento descendente (mayor descuento primero)
        notifications.sort((a, b) => b.discount_percentage - a.discount_percentage);

        // Enviar 1 email por producto por usuario, con delay entre envíos
        for (let i = 0; i < notifications.length; i++) {
            const notif = notifications[i];

            // Pausa entre emails para no saturar Resend (excepto el primero)
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            try {
                const success = await sendWishlistSaleEmail({
                    customerEmail: notif.user_email,
                    customerName: notif.user_name || undefined,
                    productName: notif.product_name,
                    productSlug: notif.product_slug,
                    productImage: notif.product_image,
                    originalPrice: notif.original_price,
                    salePrice: notif.sale_price,
                    discountPercentage: notif.discount_percentage,
                    size: notif.size,
                    baseUrl: siteUrl
                });

                if (success) {
                    // Solo marcar este ítem concreto como notificado
                    sentIds.push(notif.wishlist_id);
                } else {
                    errors.push(`Failed to send to ${notif.user_email} (${notif.product_name})`);
                }
            } catch (e) {
                errors.push(`Error sending to ${notif.user_email}: ${e}`);
            }
        }

        // Marcar como notificados solo los enviados con éxito
        if (sentIds.length > 0) {
            await markWishlistSaleNotified(sentIds);
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Enviadas ${sentIds.length} de ${notifications.length} notificaciones de ofertas`,
            sentCount: sentIds.length,
            markedCount: sentIds.length,
            errors: errors.length > 0 ? errors : undefined
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

// GET para ver estado de notificaciones pendientes (también protegido)
export const GET: APIRoute = async ({ request }) => {
    if (!await verifyAdminRequest(request)) {
        return unauthorizedResponse();
    }

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
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
