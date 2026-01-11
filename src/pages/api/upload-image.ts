import type { APIRoute } from 'astro';
import { getServiceSupabase } from '../../lib/supabase';

// Nombre del bucket en Supabase Storage
const BUCKET_NAME = 'Productos';

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return new Response(
                JSON.stringify({ error: 'No se ha proporcionado ningún archivo' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validar tipo de archivo
        if (!file.type.startsWith('image/')) {
            return new Response(
                JSON.stringify({ error: 'El archivo debe ser una imagen' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validar tamaño (máximo 5MB)
        const MAX_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return new Response(
                JSON.stringify({ error: 'El archivo es demasiado grande. Máximo 5MB.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Generar nombre único para el archivo
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const extension = file.name.split('.').pop() || 'jpg';
        const fileName = `${timestamp}-${randomString}.${extension}`;

        // Obtener cliente de Supabase con permisos de servicio
        const supabase = getServiceSupabase();

        // Convertir File a ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Subir archivo al bucket de Supabase Storage
        const { data, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, uint8Array, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Error uploading to Supabase Storage:', uploadError);
            return new Response(
                JSON.stringify({ error: `Error al subir la imagen: ${uploadError.message}` }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Obtener URL pública del archivo
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path);

        return new Response(
            JSON.stringify({
                success: true,
                url: urlData.publicUrl,
                path: data.path
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in upload-image API:', error);
        return new Response(
            JSON.stringify({ error: 'Error interno del servidor' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

// También permitir eliminar imágenes
export const DELETE: APIRoute = async ({ request }) => {
    try {
        const { path } = await request.json();

        if (!path) {
            return new Response(
                JSON.stringify({ error: 'No se ha proporcionado la ruta del archivo' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const supabase = getServiceSupabase();

        const { error: deleteError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([path]);

        if (deleteError) {
            console.error('Error deleting from Supabase Storage:', deleteError);
            return new Response(
                JSON.stringify({ error: `Error al eliminar la imagen: ${deleteError.message}` }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in delete-image API:', error);
        return new Response(
            JSON.stringify({ error: 'Error interno del servidor' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
