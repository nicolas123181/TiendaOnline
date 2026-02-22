/**
 * SISTEMA DE FACTURAS - VANTAGE
 * Generación de facturas y PDFs premium
 */

import { supabase, isSupabaseConfigured, getServiceSupabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// Configuración de la empresa (puede moverse a variables de entorno)
export const COMPANY_INFO = {
    name: 'Vantage Fashion S.L.',
    address: 'Calle de la Moda 123',
    city: '28001 Madrid, España',
    nif: 'B-12345678',
    email: 'facturas@vantage.com',
    phone: '+34 900 123 456',
    website: 'www.vantage.com',
    logo: '/images/vantage-logo.jpg'
};

// Colores de marca
const BRAND_COLORS = {
    navy: '#1a2744',
    navyLight: '#2d3f5f',
    gold: '#b8860b',
    cream: '#faf8f5'
};

export interface InvoiceItem {
    productId?: number;
    productName: string;
    productSku?: string;
    productSize?: string;
    quantity: number;
    unitPrice: number; // en céntimos
    discountPercent?: number;
}

export interface InvoiceData {
    orderId: number;
    customerName: string;
    customerEmail: string;
    customerAddress?: string;
    customerCity?: string;
    customerPostalCode?: string;
    customerPhone?: string;
    items: InvoiceItem[];
    subtotal: number; // en céntimos
    shippingCost?: number;
    discount?: number;
    taxRate?: number; // por defecto 21%
    paymentMethod?: string;
    notes?: string;
    type?: 'standard' | 'credit_note';
    originalInvoiceId?: number;
}

export interface Invoice {
    id: number;
    invoice_number: string;
    order_id: number;
    customer_name: string;
    customer_email: string;
    subtotal: number;
    shipping_cost: number;
    discount: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    issue_date: string;
    status: string;
    type: string; // 'standard' or 'credit_note'
    original_invoice_id?: number;
    pdf_url?: string;
}

/**
 * Genera un número de factura único
 */
export async function generateInvoiceNumber(dbClient?: SupabaseClient): Promise<string> {
    if (!isSupabaseConfigured) {
        const timestamp = Date.now().toString().slice(-5);
        return `VNT-${new Date().getFullYear()}-${timestamp}`;
    }

    try {
        // Usar el cliente proporcionado o service role para evitar problemas de permisos con anon
        let db: SupabaseClient;
        if (dbClient) {
            db = dbClient;
        } else {
            try {
                db = getServiceSupabase();
            } catch {
                db = supabase;
            }
        }

        const { data, error } = await db.rpc('generate_invoice_number');

        if (error) {
            // Fallback: generar número basado en timestamp + random para evitar colisiones
            const timestamp = Date.now().toString().slice(-5);
            const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
            return `VNT-${new Date().getFullYear()}-${timestamp}${random}`;
        }

        return data;
    } catch (e) {
        const timestamp = Date.now().toString().slice(-5);
        const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        return `VNT-${new Date().getFullYear()}-${timestamp}${random}`;
    }
}

/**
 * Crea una factura en la base de datos
 * Usa service role para bypasear RLS (operación server-side de confianza)
 */
export async function createInvoice(data: InvoiceData, dbClient?: SupabaseClient): Promise<Invoice | null> {

    if (!isSupabaseConfigured) {
        return null;
    }

    // Usar el cliente proporcionado, o intentar service role, o fallback a anónimo
    let db: SupabaseClient;
    if (dbClient) {
        db = dbClient;
    } else {
        try {
            db = getServiceSupabase();
        } catch (e) {
            db = supabase;
        }
    }

    try {
        // Generar número de factura (usar el mismo cliente db para permisos)
        const invoiceNumber = await generateInvoiceNumber(db);

        // Calcular impuestos (IVA YA INCLUIDO en el precio)
        // El precio del producto ya tiene el IVA incluido, así que:
        // Total = Base Imponible + IVA
        // Base Imponible = Total / 1.21 (para IVA 21%)
        const taxRate = data.taxRate ?? 21;
        const subtotalConDescuento = data.subtotal - (data.discount || 0);
        // Extraer el IVA del subtotal (ya incluido)
        const baseImponible = Math.round(subtotalConDescuento / (1 + taxRate / 100));
        const taxAmount = subtotalConDescuento - baseImponible;
        // El total es subtotal + envío (el IVA ya está incluido en el subtotal)
        const total = subtotalConDescuento + (data.shippingCost || 0);

            invoiceNumber,
            orderId: data.orderId,
            customerName: data.customerName,
            subtotal: data.subtotal,
            total
        });

        // Campos base (siempre presentes en la tabla)
        const invoiceRecord: Record<string, any> = {
            invoice_number: invoiceNumber,
            order_id: data.orderId,
            customer_name: data.customerName,
            customer_email: data.customerEmail,
            customer_address: data.customerAddress,
            customer_city: data.customerCity,
            customer_postal_code: data.customerPostalCode,
            customer_phone: data.customerPhone,
            company_name: COMPANY_INFO.name,
            company_address: `${COMPANY_INFO.address}, ${COMPANY_INFO.city}`,
            company_nif: COMPANY_INFO.nif,
            company_email: COMPANY_INFO.email,
            company_phone: COMPANY_INFO.phone,
            subtotal: data.subtotal,
            shipping_cost: data.shippingCost || 0,
            discount: data.discount || 0,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total: total,
            payment_method: data.paymentMethod || 'Tarjeta de crédito',
            payment_status: 'paid',
            status: 'issued',
            notes: data.notes,
            type: data.type || 'standard',
            original_invoice_id: data.originalInvoiceId
        };

        // Primer intento con todas las columnas
        let invoice: any = null;
        let error: any = null;

        const result1 = await db
            .from('invoices')
            .insert(invoiceRecord)
            .select()
            .single();

        invoice = result1.data;
        error = result1.error;

        // Si falla por columnas inexistentes (type/original_invoice_id), reintentar sin ellas
        if (error && (error.message?.includes('column') || error.code === '42703' || error.message?.includes('type'))) {
            
            // Eliminar columnas opcionales que pueden no existir
            delete invoiceRecord.type;
            delete invoiceRecord.original_invoice_id;

            // Regenerar invoice number por si el anterior fue consumido
            invoiceRecord.invoice_number = await generateInvoiceNumber(db);

            const result2 = await db
                .from('invoices')
                .insert(invoiceRecord)
                .select()
                .single();

            invoice = result2.data;
            error = result2.error;
        }

        if (error) {
            return null;
        }


        // Crear líneas de factura
        const invoiceItems = data.items.map(item => ({
            invoice_id: invoice.id,
            product_id: item.productId,
            product_name: item.productName,
            product_sku: item.productSku,
            product_size: item.productSize,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            discount_percent: item.discountPercent || 0,
            line_total: item.unitPrice * item.quantity
        }));

        const { error: itemsError } = await db
            .from('invoice_items')
            .insert(invoiceItems);

        if (itemsError) {
        } else {
        }

        return invoice;

    } catch (e) {
        return null;
    }
}

/**
 * Helper: obtener cliente Supabase con service role (fallback a anon)
 */
function getDbClient(): SupabaseClient {
    try {
        return getServiceSupabase();
    } catch {
        return supabase;
    }
}

/**
 * Obtiene una factura por ID
 */
export async function getInvoiceById(id: number): Promise<Invoice | null> {
    if (!isSupabaseConfigured) return null;

    const db = getDbClient();
    const { data, error } = await db
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        return null;
    }

    return data;
}

/**
 * Obtiene una factura por número
 */
export async function getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    if (!isSupabaseConfigured) return null;

    const db = getDbClient();
    const { data, error } = await db
        .from('invoices')
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .single();

    if (error) {
        return null;
    }

    return data;
}

/**
 * Obtiene la factura de un pedido
 */
export async function getInvoiceByOrderId(orderId: number): Promise<Invoice | null> {
    if (!isSupabaseConfigured) return null;

    const db = getDbClient();
    // Usar order + limit en lugar de .single() para manejar el caso de que
    // exista más de una factura por pedido (factura original + factura rectificativa).
    // Obtenemos SIEMPRE la primera factura emitida (la original, tipo 'standard').
    const { data, error } = await db
        .from('invoices')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
    }

    return data || null;
}

/**
 * Obtiene los items de una factura
 */
export async function getInvoiceItems(invoiceId: number): Promise<any[]> {
    if (!isSupabaseConfigured) return [];

    const db = getDbClient();
    const { data, error } = await db
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);

    if (error) {
        return [];
    }

    return data || [];
}

/**
 * Genera el HTML de la factura para convertir a PDF
 */
export function generateInvoiceHTML(invoice: any, items: any[]): string {
    const formatPrice = (cents: number) =>
        new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

    const itemsHTML = items.map(item => `
        <tr>
            <td style="padding: 16px 18px; border-bottom: 1px solid #e5e7eb;">
                <div style="font-weight: 500; color: ${BRAND_COLORS.navy}; margin-bottom: 4px;">${item.product_name}</div>
                ${item.product_size ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Talla: ${item.product_size}</div>` : ''}
                ${item.product_sku ? `<div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">SKU: ${item.product_sku}</div>` : ''}
            </td>
            <td style="padding: 16px 18px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4a4a4a;">
                ${item.quantity}
            </td>
            <td style="padding: 16px 18px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #4a4a4a;">
                ${formatPrice(item.unit_price)}
            </td>
            <td style="padding: 16px 18px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: ${BRAND_COLORS.navy};">
                ${formatPrice(item.line_total)}
            </td>
        </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Factura ${invoice.invoice_number}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 14px;
                line-height: 1.6;
                color: #1a1a1a;
                background: transparent;
                padding: 24px;
                margin: 0;
            }
            
            .invoice-container {
                max-width: 900px;
                margin: 0 auto;
                background: white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                border-radius: 8px;
                overflow: hidden;
            }
            
            .header {
                background: linear-gradient(135deg, ${BRAND_COLORS.navy} 0%, ${BRAND_COLORS.navyLight} 100%);
                color: white;
                padding: 36px 28px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
            }
            
            .logo {
                font-size: 26px;
                font-weight: 300;
                letter-spacing: 0.3em;
                color: ${BRAND_COLORS.gold};
            }
            
            .invoice-title {
                text-align: right;
            }
            
            .invoice-title h1 {
                font-size: 28px;
                font-weight: 300;
                margin-bottom: 6px;
            }
            
            .invoice-number {
                font-size: 16px;
                color: rgba(255,255,255,0.8);
            }
            
            .info-section {
                padding: 28px;
                display: flex;
                justify-content: space-between;
                gap: 28px;
                background: #faf8f5;
            }
            
            .info-block h3 {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: #6b7280;
                margin-bottom: 16px;
            }
            
            .info-block p {
                color: ${BRAND_COLORS.navy};
                line-height: 1.9;
            }
            
            .info-block .highlight {
                font-weight: 600;
            }
            
            .dates-section {
                padding: 18px 28px;
                background: white;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                gap: 40px;
            }
            
            .date-item {
                display: flex;
                gap: 8px;
            }
            
            .date-item .label {
                color: #6b7280;
            }
            
            .date-item .value {
                font-weight: 500;
                color: ${BRAND_COLORS.navy};
            }
            
            .items-section {
                padding: 28px;
            }
            
            table {
                width: 100%;
                border-collapse: collapse;
            }
            
            th {
                background: ${BRAND_COLORS.navy};
                color: white;
                padding: 16px 18px;
                text-align: left;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            th:last-child { text-align: right; }
            th:nth-child(2), th:nth-child(3) { text-align: center; }
            
            .totals-section {
                padding: 20px 28px 28px;
            }
            
            .totals-table {
                width: 320px;
                margin-left: auto;
            }
            
            .totals-table tr td {
                padding: 12px 0;
                font-size: 15px;
            }
            
            .totals-table tr td:first-child {
                color: #6b7280;
            }
            
            .totals-table tr td:last-child {
                text-align: right;
                font-weight: 500;
            }
            
            .totals-table .total-row {
                border-top: 2px solid ${BRAND_COLORS.navy};
            }
            
            .totals-table .total-row td {
                padding-top: 20px;
                padding-bottom: 4px;
                font-size: 20px;
                font-weight: 700;
                color: ${BRAND_COLORS.navy};
            }
            
            .footer {
                background: ${BRAND_COLORS.navy};
                color: white;
                padding: 24px 28px;
                text-align: center;
            }
            
            .footer p {
                font-size: 12px;
                line-height: 1.8;
                color: rgba(255,255,255,0.7);
                margin-bottom: 8px;
            }
            
            .footer .thanks {
                color: ${BRAND_COLORS.gold};
                font-size: 15px;
                font-weight: 500;
                margin-bottom: 18px;
            }
            
            .payment-badge {
                display: inline-block;
                background: #10b981;
                color: white;
                padding: 6px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                margin-left: 10px;
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <!-- Header -->
            <div class="header">
                <div class="logo">VANTAGE</div>
                <div class="invoice-title">
                    <h1>${invoice.type === 'credit_note' ? 'FACTURA RECTIFICATIVA' : 'FACTURA'}</h1>
                    <div class="invoice-number">${invoice.invoice_number}</div>
                </div>
            </div>
            
            <!-- Info Section -->
            <div class="info-section">
                <div class="info-block">
                    <h3>Facturar a</h3>
                    <p>
                        <span class="highlight">${invoice.customer_name}</span><br>
                        ${invoice.customer_address || ''}<br>
                        ${invoice.customer_postal_code || ''} ${invoice.customer_city || ''}<br>
                        ${invoice.customer_email}<br>
                        ${invoice.customer_phone || ''}
                    </p>
                </div>
                <div class="info-block" style="text-align: right;">
                    <h3>Datos de la empresa</h3>
                    <p>
                        <span class="highlight">${invoice.company_name}</span><br>
                        ${invoice.company_address}<br>
                        NIF: ${invoice.company_nif}<br>
                        ${invoice.company_email}<br>
                        ${invoice.company_phone}
                    </p>
                </div>
            </div>
            
            <!-- Dates -->
            <div class="dates-section">
                <div class="date-item">
                    <span class="label">Fecha de emisión:</span>
                    <span class="value">${formatDate(invoice.issue_date)}</span>
                </div>
                <div class="date-item">
                    <span class="label">Pedido:</span>
                    <span class="value">#${invoice.order_id}</span>
                </div>
                <div class="date-item">
                    <span class="label">Estado:</span>
                    <span class="payment-badge">${invoice.type === 'credit_note' ? 'REEMBOLSADO' : 'PAGADO'}</span>
                </div>
                ${invoice.original_invoice_id ? `
                <div class="date-item">
                    <span class="label">Ref. Factura:</span>
                    <span class="value">#${invoice.original_invoice_id}</span>
                </div>
                ` : ''}
            </div>
            
            <!-- Items -->
            <div class="items-section">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50%;">Descripción</th>
                            <th style="width: 15%;">Cantidad</th>
                            <th style="width: 17%;">Precio Unit.</th>
                            <th style="width: 18%;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>
            </div>
            
            <!-- Totals -->
            <div class="totals-section">
                <table class="totals-table">
                    <tr>
                        <td>Base imponible</td>
                        <td>${formatPrice(invoice.subtotal - invoice.tax_amount)}</td>
                    </tr>
                    <tr>
                        <td>IVA incluido (${invoice.tax_rate}%)</td>
                        <td>${formatPrice(invoice.tax_amount)}</td>
                    </tr>
                    <tr style="border-top: 1px solid #e5e7eb;">
                        <td>Subtotal productos</td>
                        <td>${formatPrice(invoice.subtotal)}</td>
                    </tr>
                    ${invoice.shipping_cost > 0 ? `
                    <tr>
                        <td>Envío</td>
                        <td>${formatPrice(invoice.shipping_cost)}</td>
                    </tr>
                    ` : ''}
                    ${invoice.discount > 0 ? `
                    <tr>
                        <td>Descuento</td>
                        <td>-${formatPrice(invoice.discount)}</td>
                    </tr>
                    ` : ''}
                    <tr class="total-row">
                        <td>TOTAL</td>
                        <td>${formatPrice(invoice.total)}</td>
                    </tr>
                </table>
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <p class="thanks">¡Gracias por confiar en Vantage!</p>
                <p>Esta factura ha sido generada electrónicamente y es válida sin firma.</p>
                <p>${COMPANY_INFO.website} • ${COMPANY_INFO.email}</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

/**
 * Genera un PDF binario de la factura usando pdfkit.
 * Diseñado para coincidir fielmente con generateInvoiceHTML(): mismos colores,
 * misma estructura de secciones y 4 columnas en la tabla de artículos
 * (la talla aparece como subtexto en la columna Descripción, igual que en el HTML).
 */
export async function generateInvoicePDF(invoice: any, items: any[]): Promise<Buffer> {
    // Import dinámico para compatibilidad con Vite/Astro SSR
    const PDFDocument = (await import('pdfkit')).default;

    return new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const formatPrice = (cents: number) =>
            new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
        const formatDate = (dateStr: string) =>
            new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

        // Brand colours — identical to BRAND_COLORS used in generateInvoiceHTML()
        const navy    = '#1a2744';
        const navyL   = '#2d3f5f';
        const gold    = '#b8860b';
        const cream   = '#faf8f5';
        const gray    = '#6b7280';
        const lGray   = '#e5e7eb';
        const green   = '#10b981';
        const red     = '#dc2626';

        const PW  = doc.page.width;   // 595.28
        const PH  = doc.page.height;  // 841.89
        const L   = 28;               // left margin (matches 28px padding in HTML)
        const R   = PW - 28;          // right edge
        const CW  = R - L;            // content width

        const isCreditNote = invoice.type === 'credit_note';

        // ── HEADER  (matches .header CSS: navy gradient, padding 36px 28px) ──────
        const headerH = 95;
        // gradient simulation: darker left rect + lighter right blend
        doc.rect(0, 0, PW, headerH).fill(navy);
        // subtle right-side lightening
        doc.rect(PW / 2, 0, PW / 2, headerH).fill(navyL).opacity(0.35);
        doc.opacity(1);

        // Logo: "VANTAGE" in gold (font-weight 300, letter-spacing 0.3em)
        doc.fontSize(24).fillColor(gold).font('Helvetica')
            .text('VANTAGE', L, 28, { characterSpacing: 7 });

        // Invoice title & number on the right
        const titleText = isCreditNote ? 'FACTURA RECTIFICATIVA' : 'FACTURA';
        doc.fontSize(20).fillColor('white').font('Helvetica')
            .text(titleText, L, 22, { width: CW, align: 'right' });
        doc.fontSize(12).fillColor('rgba(255,255,255,0.8)').font('Helvetica')
            .text(invoice.invoice_number, L, 50, { width: CW, align: 'right' });

        // ── INFO SECTION  (cream background, matching .info-section) ─────────────
        const infoH   = 120;
        const infoY   = headerH;
        doc.rect(0, infoY, PW, infoH).fill(cream);

        // — Left block: FACTURAR A —
        const blockL = L;
        doc.fontSize(10).fillColor(gray).font('Helvetica-Bold')
            .text('FACTURAR A', blockL, infoY + 20, { characterSpacing: 1 });
        doc.fontSize(11).fillColor(navy).font('Helvetica-Bold')
            .text(invoice.customer_name, blockL, infoY + 35);
        doc.fontSize(9.5).fillColor('#333333').font('Helvetica');
        const custLines = [
            invoice.customer_address || '',
            `${invoice.customer_postal_code || ''} ${invoice.customer_city || ''}`.trim(),
            invoice.customer_email,
            invoice.customer_phone || ''
        ].filter(Boolean);
        doc.text(custLines.join('\n'), blockL, infoY + 51, { lineGap: 3 });

        // — Right block: DATOS DE LA EMPRESA —
        const blockR  = R;
        const blockRW = 190;
        doc.fontSize(10).fillColor(gray).font('Helvetica-Bold')
            .text('DATOS DE LA EMPRESA', blockR - blockRW, infoY + 20,
                  { width: blockRW, align: 'right', characterSpacing: 1 });
        doc.fontSize(11).fillColor(navy).font('Helvetica-Bold')
            .text(invoice.company_name || COMPANY_INFO.name, blockR - blockRW, infoY + 35,
                  { width: blockRW, align: 'right' });
        doc.fontSize(9.5).fillColor('#333333').font('Helvetica');
        const compLines = [
            invoice.company_address || `${COMPANY_INFO.address}, ${COMPANY_INFO.city}`,
            `NIF: ${invoice.company_nif || COMPANY_INFO.nif}`,
            invoice.company_email || COMPANY_INFO.email,
            invoice.company_phone || COMPANY_INFO.phone
        ].filter(Boolean);
        doc.text(compLines.join('\n'), blockR - blockRW, infoY + 51,
                 { width: blockRW, align: 'right', lineGap: 3 });

        // ── DATES SECTION  (white bg, bottom border, matches .dates-section) ──────
        const datesY = infoY + infoH;
        const datesH = 36;
        doc.rect(0, datesY, PW, datesH).fill('white');
        doc.moveTo(0, datesY + datesH).lineTo(PW, datesY + datesH).stroke(lGray);

        let dx = L;
        const dateItemGap = 40;

        // fecha de emisión
        doc.fontSize(9).fillColor(gray).font('Helvetica')
            .text('Fecha de emisión:', dx, datesY + 11);
        dx += 112;
        doc.fontSize(9).fillColor(navy).font('Helvetica-Bold')
            .text(formatDate(invoice.issue_date), dx, datesY + 11);
        dx += doc.widthOfString(formatDate(invoice.issue_date)) + dateItemGap;

        // pedido
        doc.fontSize(9).fillColor(gray).font('Helvetica')
            .text('Pedido:', dx, datesY + 11);
        dx += 48;
        doc.fontSize(9).fillColor(navy).font('Helvetica-Bold')
            .text(`#${invoice.order_id}`, dx, datesY + 11);
        dx += doc.widthOfString(`#${invoice.order_id}`) + dateItemGap;

        // estado badge (rounded pill via rect + text)
        const statusText  = isCreditNote ? 'REEMBOLSADO' : 'PAGADO';
        const statusColor = isCreditNote ? red : green;
        const badgeW = 90;
        const badgeH = 18;
        dx = Math.max(dx, R - badgeW - 60); // push to right area
        doc.roundedRect(dx, datesY + 8, badgeW, badgeH, 9).fill(statusColor);
        doc.fontSize(8).fillColor('white').font('Helvetica-Bold')
            .text(statusText, dx, datesY + 13, { width: badgeW, align: 'center' });

        // ref. factura original (if credit note)
        let extraRefH = 0;
        if (invoice.original_invoice_id) {
            const refY = datesY + datesH + 6;
            extraRefH = 20;
            doc.fontSize(8.5).fillColor(gray).font('Helvetica')
                .text(`Ref. factura original: #${invoice.original_invoice_id}`, L, refY);
            doc.rect(0, datesY + datesH, PW, extraRefH).fill('#fffbf2');
            doc.fontSize(8.5).fillColor(gray).font('Helvetica')
                .text(`Ref. factura original: #${invoice.original_invoice_id}`, L, refY);
        }

        // ── ITEMS TABLE  (4 columns matching HTML: Descripción / Cantidad / Precio Unit. / Total) ──
        // col widths matching roughly HTML % widths (50 / 15 / 17 / 18 of CW)
        const tableY    = datesY + datesH + extraRefH + 10;
        const cDesc     = L;
        const wDesc     = Math.round(CW * 0.50);
        const cQty      = cDesc + wDesc;
        const wQty      = Math.round(CW * 0.14);
        const cUnit     = cQty + wQty;
        const wUnit     = Math.round(CW * 0.18);
        const cTotal    = cUnit + wUnit;
        const wTotal    = R - cTotal;

        const thH = 26;
        doc.rect(0, tableY, PW, thH).fill(navy);
        doc.fontSize(9).fillColor('white').font('Helvetica-Bold');
        doc.text('DESCRIPCIÓN',   cDesc + 6,  tableY + 8);
        doc.text('CANTIDAD',      cQty,       tableY + 8, { width: wQty,  align: 'center' });
        doc.text('PRECIO UNIT.',  cUnit,      tableY + 8, { width: wUnit, align: 'right'  });
        doc.text('TOTAL',         cTotal,     tableY + 8, { width: wTotal, align: 'right' });

        let rowY = tableY + thH;
        items.forEach((item, i) => {
            // row height depends on sub-text lines
            const hasSub = item.product_size || item.product_sku;
            const rowH   = hasSub ? 42 : 30;

            // alternating row background (cream / white — same as HTML)
            doc.rect(0, rowY, PW, rowH).fill(i % 2 === 0 ? cream : 'white');
            doc.moveTo(0, rowY + rowH).lineTo(PW, rowY + rowH).stroke(lGray);

            // description + sub-text (talla / sku)
            doc.fontSize(10).fillColor(navy).font('Helvetica-Bold')
                .text(item.product_name, cDesc + 6, rowY + 8, { width: wDesc - 10, ellipsis: true });
            if (item.product_size) {
                doc.fontSize(9).fillColor(gray).font('Helvetica')
                    .text(`Talla: ${item.product_size}`, cDesc + 6, rowY + 22, { width: wDesc - 10 });
            } else if (item.product_sku) {
                doc.fontSize(8).fillColor('#9ca3af').font('Helvetica')
                    .text(`SKU: ${item.product_sku}`, cDesc + 6, rowY + 22, { width: wDesc - 10 });
            }

            const midY = rowY + rowH / 2 - 5;
            doc.fontSize(9.5).fillColor('#4a4a4a').font('Helvetica')
                .text(String(item.quantity),          cQty,   midY, { width: wQty,  align: 'center' })
                .text(formatPrice(item.unit_price),   cUnit,  midY, { width: wUnit, align: 'right'  })
                .text(formatPrice(item.line_total),   cTotal, midY, { width: wTotal, align: 'right' });

            rowY += rowH;
        });

        // ── TOTALS  (right-aligned table matching .totals-table) ─────────────────
        const totBlockW = 300;
        const totX      = R - totBlockW;
        let totY        = rowY + 20;

        const drawTotalLine = (label: string, value: string, bold = false, topBorder = false) => {
            if (topBorder) {
                const bw = bold ? 2 : 1;
                doc.moveTo(totX, totY - 5).lineTo(R, totY - 5)
                   .lineWidth(bw).stroke(bold ? navy : lGray).lineWidth(1);
            }
            const fs = bold ? 15 : 12;
            doc.fontSize(fs).fillColor(bold ? navy : gray).font(bold ? 'Helvetica-Bold' : 'Helvetica')
               .text(label, totX, totY);
            doc.fontSize(fs).fillColor(bold ? navy : '#333333').font(bold ? 'Helvetica-Bold' : 'Helvetica')
               .text(value, totX, totY, { width: totBlockW, align: 'right' });
            totY += bold ? 24 : 20;
        };

        const baseImponible = invoice.subtotal - invoice.tax_amount;
        drawTotalLine('Base imponible', formatPrice(baseImponible));
        drawTotalLine(`IVA incluido (${invoice.tax_rate}%)`, formatPrice(invoice.tax_amount));
        drawTotalLine('Subtotal productos', formatPrice(invoice.subtotal), false, true);
        if (invoice.shipping_cost > 0) {
            drawTotalLine('Envío', formatPrice(invoice.shipping_cost));
        }
        if (invoice.discount > 0) {
            drawTotalLine('Descuento', `-${formatPrice(invoice.discount)}`);
        }
        totY += 6;
        drawTotalLine('TOTAL', formatPrice(invoice.total), true, true);

        // ── FOOTER  (navy background, gold thanks text — matches .footer) ─────────
        const footerH = 72;
        const footerY = PH - footerH;
        doc.rect(0, footerY, PW, footerH).fill(navy);

        doc.fontSize(13).fillColor(gold).font('Helvetica-Bold')
            .text('¡Gracias por confiar en Vantage!', L, footerY + 14, { width: CW, align: 'center' });
        doc.fontSize(9).fillColor('rgba(255,255,255,0.7)').font('Helvetica')
            .text(
                'Esta factura ha sido generada electrónicamente y es válida sin firma.',
                L, footerY + 34, { width: CW, align: 'center' }
            );
        doc.fontSize(9).fillColor('rgba(255,255,255,0.55)').font('Helvetica')
            .text(
                `${COMPANY_INFO.website}  •  ${COMPANY_INFO.email}`,
                L, footerY + 52, { width: CW, align: 'center' }
            );

        doc.end();
    });
}

/**
 * Actualiza el estado de una factura
 */
export async function updateInvoiceStatus(invoiceId: number, status: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    const db = getDbClient();
    const { error } = await db
        .from('invoices')
        .update({ status })
        .eq('id', invoiceId);

    if (error) {
        return false;
    }

    return true;
}

/**
 * Guarda la URL del PDF generado
 */
export async function updateInvoicePdfUrl(invoiceId: number, pdfUrl: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    const db = getDbClient();
    const { error } = await db
        .from('invoices')
        .update({
            pdf_url: pdfUrl,
            pdf_generated_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

    if (error) {
        return false;
    }

    return true;
}
