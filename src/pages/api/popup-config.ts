import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const GET: APIRoute = async () => {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const keys = [
            'popup_enabled',
            'popup_title',
            'popup_subtitle',
            'popup_description',
            'popup_promo_code',
            'popup_delay_seconds',
        ];

        const { data, error } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', keys);

        if (error) throw error;

        // Build config object with defaults
        const settings: Record<string, string> = {};
        (data || []).forEach((row: { key: string; value: string }) => {
            settings[row.key] = row.value;
        });

        const config = {
            enabled:       settings['popup_enabled']       ?? 'true',
            title:         settings['popup_title']         ?? '10% de Descuento Exclusivo',
            subtitle:      settings['popup_subtitle']      ?? 'Bienvenido a la excelencia',
            description:   settings['popup_description']   ?? 'Suscríbete a nuestra newsletter y recibe un descuento especial en tu primera compra.',
            promoCode:     settings['popup_promo_code']    ?? 'BIENVENIDO10',
            delaySeconds:  parseInt(settings['popup_delay_seconds'] ?? '5', 10),
        };

        return new Response(JSON.stringify(config), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('popup-config error:', err);
        // Return safe defaults on error so the popup still works
        return new Response(JSON.stringify({
            enabled: 'true',
            title: '10% de Descuento Exclusivo',
            subtitle: 'Bienvenido a la excelencia',
            description: 'Suscríbete a nuestra newsletter y recibe un descuento especial en tu primera compra.',
            promoCode: 'BIENVENIDO10',
            delaySeconds: 5,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
