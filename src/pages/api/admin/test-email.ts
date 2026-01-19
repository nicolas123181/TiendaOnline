import type { APIRoute } from 'astro';
import { sendWishlistSaleEmail, sendWishlistLowStockEmail } from '../../../lib/email';

export const prerender = false;

// Endpoint temporal para probar emails de wishlist
// POST con body: { type: 'sale' | 'low_stock', ...data }

export const POST: APIRoute = async ({ request }) => {
    try {
        const data = await request.json();
        const { type, ...emailData } = data;

        let success = false;

        if (type === 'sale') {
            success = await sendWishlistSaleEmail({
                customerEmail: emailData.customerEmail,
                customerName: emailData.customerName,
                productName: emailData.productName,
                productSlug: emailData.productSlug,
                productImage: emailData.productImage,
                originalPrice: emailData.originalPrice,
                salePrice: emailData.salePrice,
                discountPercentage: emailData.discountPercentage,
                size: emailData.size,
            });
        } else if (type === 'low_stock') {
            success = await sendWishlistLowStockEmail({
                customerEmail: emailData.customerEmail,
                customerName: emailData.customerName,
                productName: emailData.productName,
                productSlug: emailData.productSlug,
                productImage: emailData.productImage,
                productPrice: emailData.productPrice,
                size: emailData.size,
                stockLeft: emailData.stockLeft || 2,
            });
        } else {
            return new Response(JSON.stringify({ error: 'Invalid type. Use "sale" or "low_stock"' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            success,
            message: success ? 'Email enviado correctamente' : 'Error al enviar email'
        }), {
            status: success ? 200 : 500,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e) {
        console.error('Error in test email:', e);
        return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
