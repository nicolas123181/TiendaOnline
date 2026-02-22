import type { APIRoute } from 'astro';
import { createServerClient, createServerClientFromAuthHeader } from '../../../lib/supabase';
import { Resend } from 'resend';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

const resendApiKey = import.meta.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const SITE_URL = import.meta.env.PUBLIC_SITE_URL || 'https://nicovantage.victoriafp.online';

// Dirección de devoluciones
const RETURN_ADDRESS = {
    name: 'VANTAGE - Devoluciones',
    street: 'Calle Gran Vía 42, Local 3',
    city: '28013 Madrid',
    country: 'España',
    phone: '+34 900 123 456'
};

// Motivos de devolución
const RETURN_REASONS: Record<string, string> = {
    wrong_size: 'Talla incorrecta',
    not_as_expected: 'No es lo que esperaba',
    defective: 'Producto defectuoso',
    changed_mind: 'He cambiado de opinión',
    other: 'Otro motivo'
};

// Colores de marca
const BRAND_COLORS = {
    navy: '#1a2744',
    gold: '#b8860b'
};

/**
 * Genera un número de devolución único
 */
async function generateReturnNumber(supabase: any): Promise<string> {
    const { data } = await supabase
        .from('returns')
        .select('return_number')
        .order('id', { ascending: false })
        .limit(1);

    let nextNum = 1;
    if (data && data.length > 0) {
        const lastNum = parseInt(data[0].return_number.replace('RET-', ''));
        nextNum = lastNum + 1;
    }

    return `RET-${nextNum.toString().padStart(5, '0')}`;
}

/**
 * Verifica si el pedido está dentro del plazo de 30 días
 */
function isWithinReturnPeriod(deliveredAt: string): boolean {
    const deliveryDate = new Date(deliveredAt);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 30;
}

/**
 * Genera código de barras Code128 como PNG Buffer
 */
async function generateBarcode(text: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        bwipjs.toBuffer({
            bcid: 'code128',
            text: text,
            scale: 3,
            height: 15,
            includetext: true,
            textxalign: 'center',
            textsize: 10
        }, (err: string | Error, png: Buffer) => {
            if (err) {
                reject(typeof err === 'string' ? new Error(err) : err);
            } else {
                resolve(png);
            }
        });
    });
}

/**
 * Genera el PDF de la etiqueta de devolución profesional
 */
async function generateReturnLabelPDF(
    returnNumber: string,
    customerName: string,
    items: any[],
    address: typeof RETURN_ADDRESS
): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
        try {
            const chunks: Buffer[] = [];

            // Crear documento PDF tamaño A5 (148.5 x 210 mm)
            const doc = new PDFDocument({
                size: [420, 595], // A5 en puntos
                margin: 30
            });

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const pageWidth = 420;
            const margin = 30;
            const contentWidth = pageWidth - (margin * 2);

            // ========================================
            // HEADER
            // ========================================
            doc.rect(0, 0, pageWidth, 80)
                .fill('#1a2744');

            doc.font('Helvetica-Bold')
                .fontSize(28)
                .fillColor('#ffffff')
                .text('VANTAGE', margin, 25, { align: 'center', width: contentWidth });

            doc.fontSize(12)
                .font('Helvetica')
                .text('ETIQUETA DE DEVOLUCIÓN', margin, 52, { align: 'center', width: contentWidth });

            // ========================================
            // CÓDIGO DE BARRAS
            // ========================================
            let yPos = 100;

            // Generar código de barras
            const barcodeBuffer = await generateBarcode(returnNumber);

            // Centrar el código de barras
            const barcodeWidth = 200;
            const barcodeX = (pageWidth - barcodeWidth) / 2;

            doc.image(barcodeBuffer, barcodeX, yPos, { width: barcodeWidth });

            yPos += 70;

            // Número de devolución grande
            doc.font('Helvetica-Bold')
                .fontSize(24)
                .fillColor('#1a2744')
                .text(returnNumber, margin, yPos, { align: 'center', width: contentWidth });

            yPos += 40;

            // ========================================
            // LÍNEA DIVISORIA
            // ========================================
            doc.strokeColor('#e5e7eb')
                .lineWidth(1)
                .moveTo(margin, yPos)
                .lineTo(pageWidth - margin, yPos)
                .stroke();

            yPos += 20;

            // ========================================
            // DIRECCIÓN DE DESTINO
            // ========================================
            doc.font('Helvetica-Bold')
                .fontSize(10)
                .fillColor('#6b7280')
                .text('ENVIAR A:', margin, yPos);

            yPos += 18;

            doc.font('Helvetica-Bold')
                .fontSize(14)
                .fillColor('#1a2744')
                .text(address.name, margin, yPos);

            yPos += 20;

            doc.font('Helvetica')
                .fontSize(11)
                .fillColor('#374151')
                .text(address.street, margin, yPos);

            yPos += 16;
            doc.text(`${address.city}, ${address.country}`, margin, yPos);

            yPos += 16;
            doc.fontSize(10)
                .fillColor('#6b7280')
                .text(`Tel: ${address.phone}`, margin, yPos);

            yPos += 30;

            // ========================================
            // LÍNEA DIVISORIA
            // ========================================
            doc.strokeColor('#e5e7eb')
                .lineWidth(1)
                .moveTo(margin, yPos)
                .lineTo(pageWidth - margin, yPos)
                .stroke();

            yPos += 20;

            // ========================================
            // REMITENTE
            // ========================================
            doc.font('Helvetica-Bold')
                .fontSize(10)
                .fillColor('#6b7280')
                .text('REMITENTE:', margin, yPos);

            yPos += 18;

            doc.font('Helvetica')
                .fontSize(11)
                .fillColor('#374151')
                .text(customerName, margin, yPos);

            yPos += 30;

            // ========================================
            // PRODUCTOS
            // ========================================
            doc.font('Helvetica-Bold')
                .fontSize(10)
                .fillColor('#6b7280')
                .text('CONTENIDO:', margin, yPos);

            yPos += 18;

            items.forEach((item: any) => {
                doc.font('Helvetica')
                    .fontSize(10)
                    .fillColor('#374151')
                    .text(`• ${item.product_name} ${item.size ? `(${item.size})` : ''} × ${item.quantity}`, margin, yPos);
                yPos += 14;
            });

            yPos += 20;

            // ========================================
            // INSTRUCCIONES
            // ========================================
            doc.rect(margin, yPos, contentWidth, 60)
                .fill('#fef3c7');

            yPos += 12;

            doc.font('Helvetica-Bold')
                .fontSize(9)
                .fillColor('#92400e')
                .text('INSTRUCCIONES:', margin + 10, yPos);

            yPos += 14;

            doc.font('Helvetica')
                .fontSize(8)
                .fillColor('#78350f')
                .text('1. Recorta esta etiqueta y pégala en el exterior del paquete', margin + 10, yPos);

            yPos += 12;
            doc.text('2. Lleva el paquete a cualquier oficina de Correos', margin + 10, yPos);

            yPos += 12;
            doc.text('3. Guarda el resguardo como comprobante', margin + 10, yPos);

            yPos += 30;

            // ========================================
            // FOOTER
            // ========================================
            doc.rect(0, 535, pageWidth, 60)
                .fill('#f9fafb');

            doc.font('Helvetica')
                .fontSize(8)
                .fillColor('#9ca3af')
                .text('ENVÍO GRATUITO · NO FRANQUEAR', margin, 550, { align: 'center', width: contentWidth });

            doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, margin, 565, { align: 'center', width: contentWidth });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // Usar cliente autenticado con cookies o header Authorization
        const authHeader = request.headers.get('authorization') ??
            request.headers.get('Authorization');

        const supabase = authHeader
            ? createServerClientFromAuthHeader(authHeader)
            : createServerClient(cookies);

        const { orderId, items, reason, reasonDetails } = await request.json();

        if (!orderId || !items || !items.length || !reason) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Datos incompletos'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Obtener el pedido

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', orderId)
            .single();


        if (orderError || !order) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Pedido no encontrado',
                debug: { orderId, orderError: orderError?.message }
            }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // Verificar que el pedido esté entregado
        if (order.status !== 'delivered') {
            return new Response(JSON.stringify({
                success: false,
                error: 'Solo se pueden devolver pedidos entregados'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Verificar plazo de 30 días
        if (!isWithinReturnPeriod(order.updated_at)) {
            return new Response(JSON.stringify({
                success: false,
                error: 'El plazo de 30 días para devoluciones ha expirado'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Verificar que no exista ya una devolución para este pedido
        const { data: existingReturn } = await supabase
            .from('returns')
            .select('id')
            .eq('order_id', orderId)
            .not('status', 'eq', 'rejected')
            .limit(1);

        if (existingReturn && existingReturn.length > 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Ya existe una solicitud de devolución para este pedido'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Calcular cantidad a reembolsar
        let refundAmount = 0;
        const returnItems = items.map((item: any) => {
            const orderItem = order.order_items.find((oi: any) => oi.id === item.order_item_id);
            if (orderItem) {
                refundAmount += orderItem.product_price * item.quantity;
            }
            return {
                order_item_id: item.order_item_id,
                product_name: orderItem?.product_name || 'Producto',
                size: orderItem?.size || '',
                quantity: item.quantity,
                price: orderItem?.product_price || 0,
                product_image: orderItem?.product_image || ''
            };
        });

        // Generar número de devolución
        const returnNumber = await generateReturnNumber(supabase);

        // Crear la devolución
        const { data: newReturn, error: insertError } = await supabase
            .from('returns')
            .insert({
                return_number: returnNumber,
                order_id: orderId,
                customer_email: order.customer_email,
                customer_name: order.customer_name,
                reason,
                reason_details: reasonDetails || null,
                items: returnItems,
                refund_amount: refundAmount,
                status: 'pending'
            })
            .select()
            .single();

        if (insertError) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Error al crear la devolución'
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        // Enviar emails
        if (resend) {
            try {
                // Generar PDF de la etiqueta
                const pdfBuffer = await generateReturnLabelPDF(
                    returnNumber,
                    order.customer_name,
                    returnItems,
                    RETURN_ADDRESS
                );

                // Email al cliente con PDF adjunto
                await resend.emails.send({
                    from: 'Vantage <onboarding@resend.dev>',
                    to: order.customer_email,
                    subject: `📦 Tu etiqueta de devolución - ${returnNumber}`,
                    html: getCustomerReturnEmailHtml(order.customer_name, returnNumber, returnItems),
                    attachments: [
                        {
                            filename: `Etiqueta_Devolucion_${returnNumber}.pdf`,
                            content: pdfBuffer.toString('base64'),
                            contentType: 'application/pdf'
                        }
                    ]
                });

                // Email al admin
                await resend.emails.send({
                    from: 'Vantage <onboarding@resend.dev>',
                    to: 'p2590149@gmail.com',
                    subject: `🔄 Nueva devolución: ${returnNumber}`,
                    html: getAdminReturnEmailHtml(order.customer_name, order.customer_email, returnNumber, returnItems, reason, RETURN_REASONS[reason])
                });
            } catch (emailError) {
                // No fallamos la request por el email
            }
        }

        return new Response(JSON.stringify({
            success: true,
            returnNumber,
            message: 'Devolución creada. Revisa tu email para obtener la etiqueta.'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: (error as Error).message
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};

/**
 * Email al cliente (simplificado, el PDF va adjunto)
 */
function getCustomerReturnEmailHtml(
    customerName: string,
    returnNumber: string,
    items: any[]
): string {
    const itemsHtml = items.map(item => {
        const hasImage = item.product_image && item.product_image.startsWith('http');
        return `
        <div style="display: flex; align-items: center; margin-bottom: 12px; padding: 12px; background: #f9fafb; border-radius: 8px;">
            ${hasImage ? `<img src="${item.product_image}" alt="${item.product_name}" width="60" height="75" style="border-radius: 8px; object-fit: cover; margin-right: 15px;" />` : ''}
            <div>
                <strong>${item.product_name}</strong>
                ${item.size ? `<span style="color: #6b7280;"> (${item.size})</span>` : ''}
                <span style="color: #6b7280;"> × ${item.quantity}</span>
            </div>
        </div>
    `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: ${BRAND_COLORS.navy}; color: white; padding: 40px; text-align: center; }
            .logo { font-size: 20px; font-weight: 300; letter-spacing: 0.3em; margin-bottom: 15px; }
            .content { padding: 40px; }
            .highlight-box { background: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center; }
            .return-number { font-size: 28px; font-weight: bold; color: #166534; margin: 10px 0; }
            .steps { background: #fef3c7; border-radius: 12px; padding: 20px; margin: 25px 0; }
            .step { display: flex; align-items: flex-start; gap: 15px; margin-bottom: 15px; }
            .step-num { width: 28px; height: 28px; background: ${BRAND_COLORS.navy}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0; }
            .pdf-notice { background: linear-gradient(135deg, #1a2744 0%, #2d3a52 100%); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center; color: white; }
            .footer { text-align: center; padding: 30px; background: #f9fafb; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="header">
                    <div class="logo">VANTAGE</div>
                    <h1 style="margin: 0; font-weight: 400;">📦 Tu Devolución Está en Marcha</h1>
                </div>
                <div class="content">
                    <p>Hola <strong>${customerName}</strong>,</p>
                    <p>Hemos recibido tu solicitud de devolución. Encontrarás adjunto en este email un <strong>PDF con tu etiqueta de devolución</strong> lista para imprimir.</p>
                    
                    <div class="highlight-box">
                        <p style="margin: 0 0 5px 0; color: #166534; font-size: 14px;">Número de devolución</p>
                        <p class="return-number">${returnNumber}</p>
                        <p style="margin: 0; color: #166534; font-size: 14px;">Guarda este número como referencia</p>
                    </div>

                    <div class="pdf-notice">
                        <p style="font-size: 48px; margin: 0 0 10px 0;">📎</p>
                        <p style="margin: 0; font-size: 18px; font-weight: 600;">Etiqueta adjunta en PDF</p>
                        <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">Abre el archivo PDF adjunto, imprímelo y pégalo en tu paquete</p>
                    </div>

                    <p style="font-weight: 600; color: ${BRAND_COLORS.navy}; margin-bottom: 15px;">Productos a devolver:</p>
                    <div style="margin-bottom: 20px;">
                        ${itemsHtml}
                    </div>

                    <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin: 25px 0;">
                        <p style="margin: 0 0 15px 0; font-weight: 600;">Pasos a seguir:</p>
                        <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                            <tr>
                                <td style="width: 40px; vertical-align: top; padding-bottom: 15px;">
                                    <table cellpadding="0" cellspacing="0"><tr><td style="width: 28px; height: 28px; background: ${BRAND_COLORS.navy}; color: white; border-radius: 50%; text-align: center; vertical-align: middle; font-weight: bold; font-size: 14px; line-height: 28px;">1</td></tr></table>
                                </td>
                                <td style="vertical-align: top; padding-bottom: 15px; padding-left: 10px;"><strong>Descarga e imprime</strong> el PDF adjunto con la etiqueta.</td>
                            </tr>
                            <tr>
                                <td style="width: 40px; vertical-align: top; padding-bottom: 15px;">
                                    <table cellpadding="0" cellspacing="0"><tr><td style="width: 28px; height: 28px; background: ${BRAND_COLORS.navy}; color: white; border-radius: 50%; text-align: center; vertical-align: middle; font-weight: bold; font-size: 14px; line-height: 28px;">2</td></tr></table>
                                </td>
                                <td style="vertical-align: top; padding-bottom: 15px; padding-left: 10px;"><strong>Empaqueta</strong> los artículos de forma segura (preferiblemente en el embalaje original).</td>
                            </tr>
                            <tr>
                                <td style="width: 40px; vertical-align: top; padding-bottom: 15px;">
                                    <table cellpadding="0" cellspacing="0"><tr><td style="width: 28px; height: 28px; background: ${BRAND_COLORS.navy}; color: white; border-radius: 50%; text-align: center; vertical-align: middle; font-weight: bold; font-size: 14px; line-height: 28px;">3</td></tr></table>
                                </td>
                                <td style="vertical-align: top; padding-bottom: 15px; padding-left: 10px;"><strong>Pega la etiqueta</strong> en el exterior del paquete de forma visible.</td>
                            </tr>
                            <tr>
                                <td style="width: 40px; vertical-align: top;">
                                    <table cellpadding="0" cellspacing="0"><tr><td style="width: 28px; height: 28px; background: ${BRAND_COLORS.navy}; color: white; border-radius: 50%; text-align: center; vertical-align: middle; font-weight: bold; font-size: 14px; line-height: 28px;">4</td></tr></table>
                                </td>
                                <td style="vertical-align: top; padding-left: 10px;"><strong>Entrega</strong> el paquete en cualquier oficina de <strong>Correos</strong> (gratuito).</td>
                            </tr>
                        </table>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">Si tienes alguna pregunta, no dudes en contactarnos respondiendo a este email.</p>
                </div>
                <div class="footer">
                    <p>© 2026 Vantage. Todos los derechos reservados.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

/**
 * Email al admin sobre nueva devolución
 */
function getAdminReturnEmailHtml(
    customerName: string,
    customerEmail: string,
    returnNumber: string,
    items: any[],
    reasonCode: string,
    reasonText: string
): string {
    const itemsHtml = items.map(item => {
        const hasImage = item.product_image && item.product_image.startsWith('http');
        return `
        <div style="display: flex; align-items: center; margin-bottom: 10px; padding: 10px; background: #fffbeb; border-radius: 6px;">
            ${hasImage ? `<img src="${item.product_image}" alt="${item.product_name}" width="50" height="62" style="border-radius: 6px; object-fit: cover; margin-right: 12px;" />` : ''}
            <div>
                <strong>${item.product_name}</strong>
                ${item.size ? ` (${item.size})` : ' (Única)'}
                <span style="color: #6b7280;"> × ${item.quantity}</span>
            </div>
        </div>
    `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: #dc2626; color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .info-box { background: #fef3c7; border-radius: 8px; padding: 15px; margin: 15px 0; }
            .button { display: inline-block; background: ${BRAND_COLORS.navy}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 500; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="header">
                    <h1 style="margin: 0; font-size: 24px;">🔄 Nueva Devolución</h1>
                </div>
                <div class="content">
                    <p><strong>Número:</strong> ${returnNumber}</p>
                    <p><strong>Cliente:</strong> ${customerName} (${customerEmail})</p>
                    <p><strong>Motivo:</strong> ${reasonText}</p>
                    
                    <div class="info-box">
                        <p style="margin: 0 0 10px 0; font-weight: 600;">Productos:</p>
                        <ul style="margin: 0; padding-left: 20px;">
                            ${itemsHtml}
                        </ul>
                    </div>
                    
                    <p>El cliente ha recibido un PDF con la etiqueta para entregar el paquete en Correos.</p>
                    
                    <center style="margin-top: 25px;">
                        <a href="${SITE_URL}/perfil" class="button">Ver en Panel</a>
                    </center>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

