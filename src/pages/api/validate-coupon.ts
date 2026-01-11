import type { APIRoute } from 'astro';
import { validateCoupon } from '../../lib/supabase';

export const POST: APIRoute = async (context) => {
    try {
        const body = await context.request.json();
        const { code, total } = body;

        if (!code || !total) {
            return new Response(
                JSON.stringify({
                    valid: false,
                    discount: 0,
                    message: 'Datos incompletos'
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const result = await validateCoupon(code, total);

        return new Response(
            JSON.stringify(result),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Coupon validation error:', error);
        return new Response(
            JSON.stringify({
                valid: false,
                discount: 0,
                message: 'Error al validar el cupón'
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
