/**
 * Formatea un precio en céntimos a formato de moneda
 */
export function formatPrice(priceInCents: number, currency: string = 'EUR'): string {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency,
    }).format(priceInCents / 100);
}

/**
 * Genera un slug desde un texto
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

/**
 * Trunca un texto a un número máximo de caracteres
 */
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
}

/**
 * Clase helper para construir clases CSS condicionalmente
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(' ');
}

/**
 * Delay helper para animaciones
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Valida formato de email
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Genera URL de imagen de Supabase Storage
 */
export function getStorageUrl(bucket: string, path: string): string {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Obtiene las tallas disponibles por categoría
 */
export function getSizesForCategory(categorySlug: string): string[] {
    const sizeMappings: Record<string, string[]> = {
        'camisas': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        'camisetas': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        'pantalones': ['38', '40', '42', '44', '46', '48', '50'],
        'trajes': ['46', '48', '50', '52', '54', '56'],
        'chalecos': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        'abrigos': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    };

    return sizeMappings[categorySlug] || ['S', 'M', 'L', 'XL'];
}
