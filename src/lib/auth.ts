import { getServiceSupabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthContext {
    session: Session | null;
    user: User | null;
    isAdmin: boolean;
}

/**
 * Obtener la sesión del usuario en el servidor
 * Debe ejecutarse solo en contexto de servidor (SSR)
 */
export async function getServerSession(request: Request): Promise<Session | null> {
    try {
        // Obtener el token de las cookies
        const cookieHeader = request.headers.get('cookie');
        if (!cookieHeader) return null;

        const supabase = getServiceSupabase();
        
        // Parsear cookie para obtener el token
        const cookies = Object.fromEntries(
            cookieHeader.split('; ').map(c => c.split('='))
        );
        
        // Nota: En Supabase, la sesión se almacena de forma diferente
        // Este es un enfoque simplificado
        return null;
    } catch (error) {
        console.error('Error getting server session:', error);
        return null;
    }
}

/**
 * Verificar si el usuario actual es admin
 */
export async function verifyAdminAccess(email: string | undefined): Promise<boolean> {
    if (!email) return false;

    try {
        const supabase = getServiceSupabase();
        const { data } = await supabase
            .from('admin_users')
            .select('role')
            .eq('email', email)
            .eq('is_active', true)
            .single();

        return !!data;
    } catch (error) {
        console.error('Error verifying admin access:', error);
        return false;
    }
}

/**
 * Registrar un nuevo usuario admin
 */
export async function registerAdminUser(email: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
        const supabase = getServiceSupabase();
        
        // Crear usuario en auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (authError) {
            return { success: false, message: 'Error creando usuario: ' + authError.message };
        }

        // Registrar como admin en la tabla admin_users
        const { error: dbError } = await supabase
            .from('admin_users')
            .insert({
                email,
                role: 'editor',
                is_active: true,
            });

        if (dbError) {
            return { success: false, message: 'Error registrando admin: ' + dbError.message };
        }

        return { success: true, message: 'Usuario admin creado exitosamente' };
    } catch (error) {
        return { success: false, message: 'Error: ' + (error as Error).message };
    }
}

/**
 * Obtener todos los usuarios admin
 */
export async function getAdminUsers() {
    try {
        const supabase = getServiceSupabase();
        const { data, error } = await supabase
            .from('admin_users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return [];
        return data || [];
    } catch (error) {
        console.error('Error fetching admin users:', error);
        return [];
    }
}
