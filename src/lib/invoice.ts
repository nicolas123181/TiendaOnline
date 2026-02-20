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
            console.error('Error generating invoice number:', error);
            // Fallback: generar número basado en timestamp + random para evitar colisiones
            const timestamp = Date.now().toString().slice(-5);
            const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
            return `VNT-${new Date().getFullYear()}-${timestamp}${random}`;
        }

        return data;
    } catch (e) {
        console.error('Error in generateInvoiceNumber:', e);
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
    console.log('📋 createInvoice called with orderId:', data.orderId);

    if (!isSupabaseConfigured) {
        console.warn('⚠️ Supabase no configurado, factura no creada');
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
            console.warn('⚠️ Service role not available, using anonymous client for invoice');
            db = supabase;
        }
    }

    try {
        // Generar número de factura (usar el mismo cliente db para permisos)
        console.log('📋 Generating invoice number...');
        const invoiceNumber = await generateInvoiceNumber(db);
        console.log('📋 Invoice number generated:', invoiceNumber);

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

        console.log('📋 Inserting invoice into database...');
        console.log('📋 Data:', {
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
            console.warn('⚠️ Columnas type/original_invoice_id no encontradas, reintentando sin ellas...');
            console.warn('⚠️ Ejecuta sql/fix_invoices_missing_columns.sql en Supabase para añadirlas.');
            
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
            console.error('❌ Error inserting invoice:', error.message, error.details, error.hint);
            return null;
        }

        console.log('📋 Invoice inserted, ID:', invoice?.id);

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
            console.error('❌ Error creating invoice items:', itemsError.message);
        } else {
            console.log('📋 Invoice items created:', invoiceItems.length);
        }

        console.log(`✅ Factura ${invoiceNumber} creada para pedido #${data.orderId}`);
        return invoice;

    } catch (e) {
        console.error('❌ Exception in createInvoice:', e);
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
        console.error('Error fetching invoice:', error);
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
        console.error('Error fetching invoice by number:', error);
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
        console.error('Error fetching invoice by order:', error);
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
        console.error('Error fetching invoice items:', error);
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
 * Devuelve un Buffer con los bytes del PDF listo para adjuntar o servir.
 */
export async function generateInvoicePDF(invoice: any, items: any[]): Promise<Buffer> {
    // Import dinámico para compatibilidad con Vite/Astro SSR
    const PDFDocument = (await import('pdfkit')).default;

    return new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const formatPrice = (cents: number) =>
            new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
        const formatDate = (dateStr: string) =>
            new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

        const navy = '#1a2744';
        const gold  = '#b8860b';
        const gray  = '#6b7280';
        const lGray = '#e5e7eb';
        const red   = '#dc2626';
        const pageW = doc.page.width - 100; // width inside margins

        // ── HEADER ──────────────────────────────────────────────
        doc.rect(0, 0, doc.page.width, 90).fill(navy);

        // Logo
        doc.fontSize(22).fillColor(gold).font('Helvetica-Bold')
            .text('VANTAGE', 50, 28);
        doc.fontSize(10).fillColor('white').font('Helvetica')
            .text('FASHION', 50, 52, { characterSpacing: 4 });

        // Título factura (derecha)
        const isCreditNote = invoice.type === 'credit_note';
        const titleText = isCreditNote ? 'FACTURA RECTIFICATIVA' : 'FACTURA';
        doc.fontSize(18).fillColor('white').font('Helvetica-Bold')
            .text(titleText, 50, 25, { width: pageW, align: 'right' });
        doc.fontSize(11).fillColor('#aab4c8').font('Helvetica')
            .text(invoice.invoice_number, 50, 50, { width: pageW, align: 'right' });

        doc.moveDown(4);

        // ── INFO SECTION ─────────────────────────────────────────
        const infoY = 110;
        // Facturar a
        doc.fontSize(8).fillColor(gray).font('Helvetica-Bold')
            .text('FACTURAR A', 50, infoY, { characterSpacing: 1 });
        doc.fontSize(10).fillColor(navy).font('Helvetica-Bold')
            .text(invoice.customer_name, 50, infoY + 14);
        doc.fontSize(9).fillColor('#333').font('Helvetica')
            .text([
                invoice.customer_address || '',
                `${invoice.customer_postal_code || ''} ${invoice.customer_city || ''}`.trim(),
                invoice.customer_email,
                invoice.customer_phone || ''
            ].filter(Boolean).join('\n'), 50, infoY + 27, { lineGap: 2 });

        // Datos empresa (derecha)
        doc.fontSize(8).fillColor(gray).font('Helvetica-Bold')
            .text('DATOS DEL EMISOR', 430, infoY, { align: 'right', width: 165, characterSpacing: 1 });
        doc.fontSize(10).fillColor(navy).font('Helvetica-Bold')
            .text(invoice.company_name || COMPANY_INFO.name, 430, infoY + 14, { align: 'right', width: 165 });
        doc.fontSize(9).fillColor('#333').font('Helvetica')
            .text([
                invoice.company_address || `${COMPANY_INFO.address}, ${COMPANY_INFO.city}`,
                `NIF: ${invoice.company_nif || COMPANY_INFO.nif}`,
                invoice.company_email || COMPANY_INFO.email,
                invoice.company_phone || COMPANY_INFO.phone
            ].filter(Boolean).join('\n'), 430, infoY + 27, { align: 'right', width: 165, lineGap: 2 });

        // ── DATES BAR ────────────────────────────────────────────
        const datesY = 230;
        doc.rect(50, datesY, pageW, 26).fill('#f9fafb');
        doc.rect(50, datesY, pageW, 26).stroke(lGray);

        doc.fontSize(8).fillColor(gray).font('Helvetica')
            .text('Fecha de emisión:', 60, datesY + 8);
        doc.fontSize(8).fillColor(navy).font('Helvetica-Bold')
            .text(formatDate(invoice.issue_date), 145, datesY + 8);

        doc.fontSize(8).fillColor(gray).font('Helvetica')
            .text('Pedido:', 270, datesY + 8);
        doc.fontSize(8).fillColor(navy).font('Helvetica-Bold')
            .text(`#${invoice.order_id}`, 300, datesY + 8);

        const statusText = isCreditNote ? 'REEMBOLSADO' : 'PAGADO';
        const statusColor = isCreditNote ? red : '#16a34a';
        doc.rect(430, datesY + 4, 80, 18).fill(statusColor);
        doc.fontSize(7).fillColor('white').font('Helvetica-Bold')
            .text(statusText, 430, datesY + 9, { width: 80, align: 'center' });

        if (invoice.original_invoice_id) {
            doc.fontSize(8).fillColor(gray).font('Helvetica')
                .text(`Ref. factura: #${invoice.original_invoice_id}`, 50, datesY + 34);
        }

        // ── ITEMS TABLE ───────────────────────────────────────────
        const tableTop = invoice.original_invoice_id ? 282 : 272;
        const colDesc   = 50;
        const colSize   = 290;
        const colQty    = 365;
        const colUnit   = 420;
        const colTotal  = 490;

        // Header row
        doc.rect(colDesc, tableTop, pageW, 22).fill(navy);
        doc.fontSize(8).fillColor('white').font('Helvetica-Bold');
        doc.text('DESCRIPCIÓN',  colDesc + 6,  tableTop + 7);
        doc.text('TALLA',        colSize,  tableTop + 7);
        doc.text('CANT.',        colQty,   tableTop + 7);
        doc.text('PRECIO UNIT.', colUnit,  tableTop + 7);
        doc.text('TOTAL',        colTotal, tableTop + 7);

        // Item rows
        let rowY = tableTop + 22;
        items.forEach((item, i) => {
            const rowH = 28;
            if (i % 2 === 0) {
                doc.rect(colDesc, rowY, pageW, rowH).fill('#faf8f5');
            } else {
                doc.rect(colDesc, rowY, pageW, rowH).fill('white');
            }
            doc.rect(colDesc, rowY, pageW, rowH).stroke(lGray);

            doc.fontSize(9).fillColor(navy).font('Helvetica-Bold')
                .text(item.product_name, colDesc + 6, rowY + 6, { width: 225, ellipsis: true });
            if (item.product_sku) {
                doc.fontSize(7).fillColor(gray).font('Helvetica')
                    .text(`SKU: ${item.product_sku}`, colDesc + 6, rowY + 17, { width: 225 });
            }
            doc.fontSize(9).fillColor('#444').font('Helvetica')
                .text(item.product_size || '—', colSize, rowY + 9)
                .text(String(item.quantity), colQty + 6, rowY + 9)
                .text(formatPrice(item.unit_price), colUnit, rowY + 9)
                .text(formatPrice(item.line_total), colTotal, rowY + 9);

            rowY += rowH;
        });

        // ── TOTALS ────────────────────────────────────────────────
        const totalsX = 370;
        let totY = rowY + 16;

        const drawTotalRow = (label: string, value: string, bold = false, lineAbove = false) => {
            if (lineAbove) {
                doc.moveTo(totalsX, totY - 4).lineTo(595, totY - 4).stroke(lGray);
            }
            doc.fontSize(bold ? 11 : 9)
               .fillColor(bold ? navy : gray)
               .font(bold ? 'Helvetica-Bold' : 'Helvetica')
               .text(label, totalsX, totY);
            doc.fontSize(bold ? 11 : 9)
               .fillColor(bold ? navy : '#333')
               .font(bold ? 'Helvetica-Bold' : 'Helvetica')
               .text(value, totalsX, totY, { width: 595 - totalsX, align: 'right' });
            totY += bold ? 18 : 16;
        };

        const baseImponible = invoice.subtotal - invoice.tax_amount;
        drawTotalRow('Base imponible', formatPrice(baseImponible));
        drawTotalRow(`IVA incluido (${invoice.tax_rate}%)`, formatPrice(invoice.tax_amount));
        drawTotalRow('Subtotal', formatPrice(invoice.subtotal), false, true);
        if (invoice.shipping_cost > 0) {
            drawTotalRow('Envío', formatPrice(invoice.shipping_cost));
        }
        if (invoice.discount > 0) {
            drawTotalRow('Descuento', `-${formatPrice(invoice.discount)}`);
        }
        totY += 4;
        drawTotalRow('TOTAL', formatPrice(invoice.total), true, true);

        // ── FOOTER ────────────────────────────────────────────────
        const footerY = doc.page.height - 70;
        doc.rect(0, footerY, doc.page.width, 70).fill(navy);
        doc.fontSize(10).fillColor(gold).font('Helvetica-Bold')
            .text('¡Gracias por confiar en Vantage!', 50, footerY + 12, { width: pageW, align: 'center' });
        doc.fontSize(8).fillColor('#9db4cc').font('Helvetica')
            .text(
                'Esta factura ha sido generada electrónicamente y es válida sin firma.',
                50, footerY + 28, { width: pageW, align: 'center' }
            );
        doc.fontSize(8).fillColor('#7a9ab8').font('Helvetica')
            .text(
                `${COMPANY_INFO.website}  •  ${COMPANY_INFO.email}  •  ${COMPANY_INFO.nif}`,
                50, footerY + 44, { width: pageW, align: 'center' }
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
        console.error('Error updating invoice status:', error);
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
        console.error('Error updating invoice PDF URL:', error);
        return false;
    }

    return true;
}
