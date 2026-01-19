import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { newPassword, confirmPassword } = await request.json();

        // Validaciones
        if (!newPassword || !confirmPassword) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Todos los campos son requeridos'
            }), { status: 400 });
        }

        if (newPassword !== confirmPassword) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Las contraseñas no coinciden'
            }), { status: 400 });
        }

        if (newPassword.length < 6) {
            return new Response(JSON.stringify({
                success: false,
                error: 'La contraseña debe tener al menos 6 caracteres'
            }), { status: 400 });
        }

        // Obtener token de acceso del usuario
        const accessToken = cookies.get('sb-access-token')?.value;
        const refreshToken = cookies.get('sb-refresh-token')?.value;

        if (!accessToken) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No estás autenticado'
            }), { status: 401 });
        }

        // Crear cliente con el token del usuario
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        });

        // Verificar sesión
        const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

        if (userError || !user) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Sesión inválida. Por favor, vuelve a iniciar sesión.'
            }), { status: 401 });
        }

        // Actualizar contraseña usando service role
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { password: newPassword }
        );

        if (updateError) {
            console.error('Error updating password:', updateError);
            return new Response(JSON.stringify({
                success: false,
                error: 'Error al actualizar la contraseña. Inténtalo de nuevo.'
            }), { status: 500 });
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Contraseña actualizada correctamente'
        }), { status: 200 });

    } catch (error) {
        console.error('Change password error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error interno del servidor'
        }), { status: 500 });
    }
};
