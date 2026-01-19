/**
 * API Endpoint: Generar y visualizar/descargar factura
 * GET /api/invoice/[id]/pdf
 * GET /api/invoice/[id]/pdf?download=true - Abre diálogo de impresión automáticamente
 */

import type { APIRoute } from 'astro';
import { getInvoiceById, getInvoiceItems, generateInvoiceHTML } from '../../../../lib/invoice';

export const GET: APIRoute = async ({ params, url }) => {
    const invoiceId = parseInt(params.id || '0');
    const autoDownload = url.searchParams.get('download') === 'true';

    if (!invoiceId) {
        return new Response(JSON.stringify({ error: 'ID de factura inválido' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Obtener factura
        const invoice = await getInvoiceById(invoiceId);

        if (!invoice) {
            return new Response(JSON.stringify({ error: 'Factura no encontrada' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Obtener items de la factura
        const items = await getInvoiceItems(invoiceId);

        // Generar HTML de la factura
        let html = generateInvoiceHTML(invoice, items);

        // Si se solicita descarga, añadir script de impresión automática
        if (autoDownload) {
            const printScript = `
            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
            `;
            html = html.replace('</body>', `${printScript}</body>`);
        }

        // Devolver HTML (se puede imprimir como PDF desde el navegador)
        return new Response(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': `inline; filename="factura-${invoice.invoice_number}.html"`
            }
        });

    } catch (error) {
        console.error('Error generating invoice PDF:', error);
        return new Response(JSON.stringify({ error: 'Error al generar la factura' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
