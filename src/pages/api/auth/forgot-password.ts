import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const POST: APIRoute = async ({ request, url }) => {
    try {
        const { email } = await request.json();

        if (!email) {
            return new Response(JSON.stringify({
                success: false,
                error: 'El email es requerido'
            }), { status: 400 });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Email inválido'
            }), { status: 400 });
        }

        // Usar anon key - resetPasswordForEmail es una operación pública
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // URL de redirección para resetear contraseña
        const redirectTo = `${url.origin}/restablecer-contrasena`;

        // Enviar email de recuperación
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo
        });

        if (error) {
            console.error('Password reset error:', error);
            // No revelar si el email existe o no por seguridad
            return new Response(JSON.stringify({
                success: true,
                message: 'Si el email está registrado, recibirás un enlace para restablecer tu contraseña.'
            }), { status: 200 });
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Te hemos enviado un email con las instrucciones para restablecer tu contraseña.'
        }), { status: 200 });

    } catch (error) {
        console.error('Forgot password error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error al procesar la solicitud'
        }), { status: 500 });
    }
};
