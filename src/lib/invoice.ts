/**
 * SISTEMA DE FACTURAS - VANTAGE
 * Generación de facturas y PDFs premium
 */

import { supabase, isSupabaseConfigured } from './supabase';

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
export async function generateInvoiceNumber(): Promise<string> {
    if (!isSupabaseConfigured) {
        const timestamp = Date.now().toString().slice(-5);
        return `VNT-${new Date().getFullYear()}-${timestamp}`;
    }

    try {
        const { data, error } = await supabase.rpc('generate_invoice_number');

        if (error) {
            console.error('Error generating invoice number:', error);
            // Fallback: generar número basado en timestamp
            const timestamp = Date.now().toString().slice(-5);
            return `VNT-${new Date().getFullYear()}-${timestamp}`;
        }

        return data;
    } catch (e) {
        console.error('Error in generateInvoiceNumber:', e);
        const timestamp = Date.now().toString().slice(-5);
        return `VNT-${new Date().getFullYear()}-${timestamp}`;
    }
}

/**
 * Crea una factura en la base de datos
 */
export async function createInvoice(data: InvoiceData): Promise<Invoice | null> {
    console.log('📋 createInvoice called with orderId:', data.orderId);

    if (!isSupabaseConfigured) {
        console.warn('⚠️ Supabase no configurado, factura no creada');
        return null;
    }

    try {
        // Generar número de factura
        console.log('📋 Generating invoice number...');
        const invoiceNumber = await generateInvoiceNumber();
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

        // Crear factura
        const { data: invoice, error } = await supabase
            .from('invoices')
            .insert({
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
            })
            .select()
            .single();

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

        const { error: itemsError } = await supabase
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
 * Obtiene una factura por ID
 */
export async function getInvoiceById(id: number): Promise<Invoice | null> {
    if (!isSupabaseConfigured) return null;

    const { data, error } = await supabase
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

    const { data, error } = await supabase
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

    const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('order_id', orderId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('Error fetching invoice by order:', error);
    }

    return data || null;
}

/**
 * Obtiene los items de una factura
 */
export async function getInvoiceItems(invoiceId: number): Promise<any[]> {
    if (!isSupabaseConfigured) return [];

    const { data, error } = await supabase
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
 * Actualiza el estado de una factura
 */
export async function updateInvoiceStatus(invoiceId: number, status: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    const { error } = await supabase
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

    const { error } = await supabase
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
