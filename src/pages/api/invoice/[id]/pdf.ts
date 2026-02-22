/**
 * API Endpoint: Descargar factura como PDF real
 * GET /api/invoice/[id]/pdf
 */

import type { APIRoute } from 'astro';
import { getInvoiceById, getInvoiceItems, generateInvoicePDF } from '../../../../lib/invoice';

export const GET: APIRoute = async ({ params }) => {
    const invoiceId = parseInt(params.id || '0');

    if (!invoiceId) {
        return new Response(JSON.stringify({ error: 'ID de factura inválido' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const invoice = await getInvoiceById(invoiceId);

        if (!invoice) {
            return new Response(JSON.stringify({ error: 'Factura no encontrada' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const items = await getInvoiceItems(invoiceId);
        const pdfBuffer = await generateInvoicePDF(invoice, items);

        const filename = `factura-${invoice.invoice_number}.pdf`;

        return new Response(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${filename}"`,
                'Content-Length': pdfBuffer.length.toString()
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Error al generar el PDF de la factura' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
