import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: import.meta.env.CLOUDINARY_CLOUD_NAME,
    api_key: import.meta.env.CLOUDINARY_API_KEY,
    api_secret: import.meta.env.CLOUDINARY_API_SECRET,
    secure: true
});

export interface UploadResult {
    url: string;
    publicId: string;
    width: number;
    height: number;
}

/**
 * Upload an image to Cloudinary
 * @param buffer - The file buffer to upload
 * @param options - Upload options
 */
export async function uploadImage(
    buffer: Buffer,
    options?: {
        folder?: string;
        filename?: string;
    }
): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
        const uploadOptions = {
            folder: options?.folder || 'productos',
            public_id: options?.filename,
            resource_type: 'image' as const,
            transformation: [
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
            ]
        };

        cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) {
                    reject(error);
                } else if (result) {
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                        width: result.width,
                        height: result.height
                    });
                } else {
                    reject(new Error('No result from Cloudinary'));
                }
            }
        ).end(buffer);
    });
}

/**
 * Delete an image from Cloudinary
 * @param publicId - The public ID of the image to delete
 */
export async function deleteImage(publicId: string): Promise<boolean> {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result.result === 'ok';
    } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
        return false;
    }
}

/**
 * Extract public ID from a Cloudinary URL
 * @param url - The Cloudinary URL
 */
export function getPublicIdFromUrl(url: string): string | null {
    try {
        // Cloudinary URLs have format: https://res.cloudinary.com/{cloud}/image/upload/{version}/{folder}/{public_id}.{ext}
        const regex = /\/upload\/(?:v\d+\/)?(.+)\.\w+$/;
        const match = url.match(regex);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

/**
 * Get an optimized URL for an image
 * @param publicId - The public ID of the image
 * @param options - Transformation options
 */
export function getOptimizedUrl(
    publicId: string,
    options?: {
        width?: number;
        height?: number;
        crop?: 'fill' | 'fit' | 'scale' | 'thumb';
    }
): string {
    const transformations: any[] = [
        { quality: 'auto' },
        { fetch_format: 'auto' }
    ];

    if (options?.width || options?.height) {
        transformations.push({
            width: options.width,
            height: options.height,
            crop: options.crop || 'fill'
        });
    }

    return cloudinary.url(publicId, {
        transformation: transformations,
        secure: true
    });
}

export { cloudinary };
