import type { APIRoute } from 'astro';
import { uploadImage, deleteImage, getPublicIdFromUrl } from '../../lib/cloudinary';

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

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return new Response(
                JSON.stringify({ error: 'El archivo debe ser una imagen' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validate size (max 10MB for Cloudinary)
        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return new Response(
                JSON.stringify({ error: 'El archivo es demasiado grande. Máximo 10MB.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const filename = `${timestamp}-${randomString}`;

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Cloudinary
        const result = await uploadImage(buffer, {
            folder: 'productos',
            filename: filename
        });

        return new Response(
            JSON.stringify({
                success: true,
                url: result.url,
                publicId: result.publicId,
                width: result.width,
                height: result.height
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in upload-image API:', error);
        return new Response(
            JSON.stringify({ error: 'Error interno del servidor al subir la imagen' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

// Delete images
export const DELETE: APIRoute = async ({ request }) => {
    try {
        const { url, publicId } = await request.json();

        // Get public ID from URL if not provided directly
        let idToDelete = publicId;
        if (!idToDelete && url) {
            // Only try to delete if it's a Cloudinary URL
            if (url.includes('cloudinary.com')) {
                idToDelete = getPublicIdFromUrl(url);
            } else {
                // It's a Supabase URL or other - just return success (don't try to delete)
                return new Response(
                    JSON.stringify({ success: true, message: 'URL externa, no se eliminó de Cloudinary' }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }

        if (!idToDelete) {
            return new Response(
                JSON.stringify({ error: 'No se pudo determinar el ID de la imagen' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const deleted = await deleteImage(idToDelete);

        if (!deleted) {
            return new Response(
                JSON.stringify({ error: 'Error al eliminar la imagen' }),
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
