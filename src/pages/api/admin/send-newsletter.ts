import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { Resend } from 'resend';

const resendApiKey = import.meta.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Colores de marca Vantage
const BRAND_COLORS = {
    navy: '#1a2744',
    navyLight: '#2d4a6f',
    cream: '#f8f5f0',
    gold: '#b8860b'
};

/**
 * API para enviar newsletter a todos los suscriptores
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        if (!resend) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Email service no configurado'
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        const body = await request.json();
        const { subject, preview, content } = body;
        // Optional: allow caller to provide explicit recipients to send to
        // Format: [{ email: string, name?: string }, ...]
        const explicitRecipients = Array.isArray(body.recipients) ? body.recipients : null;

        if (!subject || !content) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Asunto y contenido son requeridos'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Obtener suscriptores: si el cliente envía una lista explícita, usarla.
        let subscribers: Array<{ email: string; name?: string }> | null = null;

        if (explicitRecipients && explicitRecipients.length > 0) {
            subscribers = explicitRecipients.map((r: any) => ({
                email: String(r.email),
                name: r.name ? String(r.name) : undefined,
            }));
        } else {
            // Obtener suscriptores activos desde la BD
            const { data: dbSubscribers, error: subError } = await supabase
                .from('newsletter_subscribers')
                .select('email, name')
                .eq('is_active', true);

            if (subError) {
                console.error('Error fetching subscribers:', subError);
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Error al obtener suscriptores'
                }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }

            subscribers = dbSubscribers as any[] || [];
        }

        if (!subscribers || subscribers.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No hay suscriptores activos'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        console.log(`📧 Sending newsletter to ${subscribers.length} subscribers`);

        // Generar HTML del newsletter
        const htmlContent = generateNewsletterHtml(subject, content, preview);

        // Enviar emails (en lotes para evitar límites)
        let sentCount = 0;
        let errors: string[] = [];

        for (const sub of subscribers) {
            try {
                await resend.emails.send({
                    from: 'Vantage <onboarding@resend.dev>',
                    to: sub.email,
                    subject: subject,
                    html: htmlContent.replace('{{name}}', sub.name || 'Cliente'),
                });
                sentCount++;
                console.log(`✅ Sent to ${sub.email}`);
            } catch (e) {
                console.error(`❌ Failed to send to ${sub.email}:`, e);
                errors.push(sub.email);
            }
        }

        console.log(`📧 Newsletter sent: ${sentCount}/${subscribers.length}`);

        return new Response(JSON.stringify({
            success: true,
            message: `Newsletter enviado a ${sentCount} suscriptores`,
            sentCount,
            errors: errors.length > 0 ? errors : undefined
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Newsletter error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: (error as Error).message
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};

/**
 * Genera el HTML del newsletter
 */
function generateNewsletterHtml(subject: string, content: string, preview?: string): string {
    // Convertir saltos de línea en HTML
    const htmlContent = content
        .split('\n')
        .map(line => line.trim() ? `<p style="margin: 0 0 15px 0;">${line}</p>` : '')
        .join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${preview ? `<meta name="description" content="${preview}">` : ''}
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                line-height: 1.7; 
                color: #333; 
                margin: 0; 
                padding: 0; 
                background: #f5f5f5;
            }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .card { 
                background: white; 
                border-radius: 16px; 
                overflow: hidden; 
                box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
            }
            .header { 
                background: ${BRAND_COLORS.navy}; 
                color: white; 
                padding: 40px; 
                text-align: center; 
            }
            .header h1 { margin: 15px 0 0 0; font-size: 24px; font-weight: 400; }
            .header .logo { 
                font-size: 28px; 
                font-weight: 300; 
                letter-spacing: 0.3em;
            }
            .content { padding: 40px; font-size: 16px; }
            .greeting { font-size: 18px; margin-bottom: 25px; }
            .button { 
                display: inline-block; 
                background: ${BRAND_COLORS.navy}; 
                color: white; 
                padding: 16px 40px; 
                text-decoration: none; 
                border-radius: 8px; 
                font-weight: 500; 
                letter-spacing: 0.05em;
                margin: 25px 0;
            }
            .footer { 
                text-align: center; 
                padding: 30px; 
                background: #f9fafb; 
                color: #6b7280; 
                font-size: 12px;
            }
            .footer a { color: ${BRAND_COLORS.navy}; text-decoration: none; }
            .divider { 
                height: 1px; 
                background: #e5e7eb; 
                margin: 30px 0; 
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="header">
                    <div class="logo">VANTAGE</div>
                    <h1>${subject}</h1>
                </div>
                <div class="content">
                    <p class="greeting">Hola <strong>{{name}}</strong>,</p>
                    
                    ${htmlContent}
                    
                    <div class="divider"></div>
                    
                    <center>
                        <a href="https://vantage.com" class="button">Visitar la Tienda</a>
                    </center>
                </div>
                <div class="footer">
                    <p>Has recibido este email porque estás suscrito al newsletter de Vantage.</p>
                    <p>
                        <a href="https://vantage.com/perfil">Gestionar suscripción</a> | 
                        <a href="https://vantage.com">Visitar web</a>
                    </p>
                    <p style="margin-top: 20px;">© 2026 Vantage. Todos los derechos reservados.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}
