import type { APIRoute } from 'astro';
import { getSetting } from '../../lib/supabase';

export const GET: APIRoute = async () => {
    try {
        // Get popup configuration from database
        const popupEnabled = await getSetting("popup_enabled") || "true";
        const popupTitle = await getSetting("popup_title") || "10% de Descuento Exclusivo";
        const popupMessage = await getSetting("popup_message") || "Suscríbete a nuestra newsletter y recibe un descuento especial en tu primera compra.";
        const popupPromoCode = await getSetting("popup_promo_code") || "BIENVENIDO10";
        const popupDiscount = await getSetting("popup_discount") || "10";

        return new Response(JSON.stringify({
            enabled: popupEnabled === "true",
            title: popupTitle,
            message: popupMessage,
            promoCode: popupPromoCode,
            discount: popupDiscount
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error fetching popup config:', error);
        // Return defaults on error
        return new Response(JSON.stringify({
            enabled: true,
            title: "10% de Descuento Exclusivo",
            message: "Suscríbete a nuestra newsletter y recibe un descuento especial en tu primera compra.",
            promoCode: "BIENVENIDO10",
            discount: "10"
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
