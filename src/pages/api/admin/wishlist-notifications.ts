import type { APIRoute } from 'astro';
import {
    getWishlistLowStockNotifications,
    markWishlistNotified,
    isSupabaseConfigured
} from '../../../lib/supabase';
import { sendWishlistLowStockEmail } from '../../../lib/email';
import { verifyAdminRequest, unauthorizedResponse } from '../../../lib/adminAuth';

export const prerender = false;

// Este endpoint debe ser llamado por un cron job o manualmente desde el admin
// GET para probar, POST para ejecutar
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

        // Ordenar por stock ascendente (más urgentes primero)
        notifications.sort((a, b) => a.size_stock - b.size_stock);

        // Enviar 1 email por producto por usuario, con delay entre envíos
        for (let i = 0; i < notifications.length; i++) {
            const notif = notifications[i];

            // Pausa entre emails para no saturar Resend (excepto el primero)
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            try {
                const success = await sendWishlistLowStockEmail({
                    customerEmail: notif.user_email,
                    customerName: notif.user_name || 'Cliente',
                    productName: notif.product_name,
                    productSlug: notif.product_slug,
                    productImage: notif.product_image,
                    productPrice: notif.product_price,
                    size: notif.size,
                    stockLeft: notif.size_stock,
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
            await markWishlistNotified(sentIds);
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Enviadas ${sentIds.length} de ${notifications.length} notificaciones`,
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

// GET para probar/ver estado (también protegido)
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
        const notifications = await getWishlistLowStockNotifications(9);

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
