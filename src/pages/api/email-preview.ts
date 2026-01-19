import type { APIRoute } from 'astro';

const BRAND = { navy: '#1a2744', gold: '#b8860b', success: '#16a34a', purple: '#7c3aed' };

const emails: Record<string, string> = {
    'order-confirmation': `
    <div style="font-family:system-ui;background:#f8f5f0;padding:30px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,${BRAND.navy},#2d4a6f);padding:45px 30px;text-align:center">
          <p style="font-size:28px;font-weight:300;letter-spacing:0.3em;color:${BRAND.gold};margin:0 0 20px">VANTAGE</p>
          <p style="font-size:50px;margin:0 0 15px">✅</p>
          <h1 style="color:#fff;font-size:28px;margin:0">¡Pedido Confirmado!</h1>
          <p style="color:${BRAND.gold};font-size:20px;font-weight:600;margin:15px 0 0">Pedido #00123</p>
        </div>
        <div style="padding:40px 30px">
          <p style="font-size:18px">Hola <strong>Carlos García</strong>,</p>
          <p>¡Gracias por tu compra! Tu pedido ha sido confirmado y está siendo procesado.</p>
          <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:25px 0">
            <table width="100%" style="border-collapse:collapse">
              <tr style="background:${BRAND.navy};color:#fff"><td style="padding:15px">Producto</td><td style="padding:15px;text-align:center">Cant.</td><td style="padding:15px;text-align:right">Total</td></tr>
              <tr><td style="padding:15px;border-bottom:1px solid #e5e7eb"><strong>Chaqueta Premium Navy</strong><br><small>Talla: M</small></td><td style="padding:15px;text-align:center;border-bottom:1px solid #e5e7eb">1</td><td style="padding:15px;text-align:right;border-bottom:1px solid #e5e7eb;font-weight:700">€149,00</td></tr>
              <tr><td style="padding:15px"><strong>Polo Classic White</strong><br><small>Talla: L</small></td><td style="padding:15px;text-align:center">2</td><td style="padding:15px;text-align:right;font-weight:700">€98,00</td></tr>
            </table>
          </div>
          <div style="background:#f0f4f8;border-radius:12px;padding:20px;margin:25px 0">
            <p>Subtotal: <strong>€247,00</strong></p>
            <p>Envío: <strong style="color:${BRAND.success}">GRATIS</strong></p>
            <p style="font-size:24px;font-weight:700;color:${BRAND.navy}">Total: €247,00</p>
          </div>
          <div style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:12px;padding:25px;text-align:center;margin:25px 0">
            <p style="font-size:40px;margin:0 0 10px">📄</p>
            <h3 style="color:${BRAND.navy};margin:0 0 8px">Tu Factura Está Lista</h3>
            <p style="color:#0369a1;font-weight:600">Factura #VNT-2026-00123</p>
            <a href="#" style="display:inline-block;background:#0284c7;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700">Ver Detalles y Factura</a>
          </div>
        </div>
        <div style="background:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="color:#6b7280;font-size:14px;margin:0">© 2026 Vantage. Moda Masculina Premium.</p>
        </div>
      </div>
    </div>`,
    'shipping': `
    <div style="font-family:system-ui;background:#f8f5f0;padding:30px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);padding:45px 30px;text-align:center">
          <p style="font-size:24px;letter-spacing:0.3em;color:rgba(255,255,255,0.9);margin:0 0 20px">VANTAGE</p>
          <p style="font-size:50px;margin:0 0 15px">📦</p>
          <h1 style="color:#fff;font-size:28px;margin:0">¡Tu Pedido ha sido Enviado!</h1>
        </div>
        <div style="padding:40px 30px">
          <p>Hola <strong>Carlos García</strong>,</p>
          <p>¡Buenas noticias! Tu pedido ya está en camino.</p>
          <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:2px solid #10b981;border-radius:16px;padding:30px;text-align:center;margin:25px 0">
            <p style="font-size:14px;color:#6b7280;margin:0 0 8px">Número de Pedido</p>
            <p style="font-size:28px;font-weight:700;color:#065f46;margin:0 0 20px">#00123</p>
            <div style="background:#fff;border-radius:12px;padding:20px;margin:15px 0">
              <p style="font-size:14px;color:#6b7280;margin:0 0 5px">📍 Número de Seguimiento</p>
              <p style="font-size:20px;font-weight:700;color:${BRAND.navy};font-family:monospace">MRWES123456789</p>
            </div>
            <a href="#" style="display:inline-block;background:${BRAND.success};color:#fff;padding:16px 40px;border-radius:8px;text-decoration:none;font-weight:700;margin:15px 0">🔍 Rastrear Pedido</a>
          </div>
        </div>
        <div style="background:#f9fafb;padding:30px;text-align:center"><p style="color:#6b7280;font-size:14px;margin:0">© 2026 Vantage</p></div>
      </div>
    </div>`,
    'pickup': `
    <div style="font-family:system-ui;background:#f5f5f5;padding:40px 20px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
        <div style="background:#d97706;color:#fff;padding:40px;text-align:center">
          <p style="font-size:20px;letter-spacing:0.3em;margin:0 0 10px;opacity:0.9">VANTAGE</p>
          <p style="font-size:60px;margin:0 0 15px">🎉</p>
          <h1 style="margin:0;font-weight:400">¡Tu pedido está listo!</h1>
        </div>
        <div style="padding:40px">
          <p>Hola <strong>Carlos García</strong>,</p>
          <p>Tu pedido está <strong>listo para recoger</strong> en nuestra tienda.</p>
          <div style="background:#fef3c7;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
            <p style="margin:0 0 5px;color:#6b7280">Número de pedido</p>
            <span style="font-size:32px;font-weight:bold;color:#d97706">#00123</span>
          </div>
          <div style="background:#fffbeb;border-left:4px solid #d97706;padding:20px;border-radius:0 8px 8px 0;margin:20px 0">
            <p style="margin:0"><strong>🏪 Recogida en Tienda</strong></p>
            <p style="margin:10px 0 0;color:#6b7280">Trae tu DNI o número de pedido.</p>
          </div>
        </div>
        <div style="text-align:center;padding:30px;background:#f9fafb"><p style="color:#6b7280;font-size:14px;margin:0">© 2026 Vantage</p></div>
      </div>
    </div>`,
    'delivered': `
    <div style="font-family:system-ui;background:#f8f5f0;padding:30px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#059669,#047857);padding:45px 30px;text-align:center">
          <p style="font-size:24px;letter-spacing:0.3em;color:rgba(255,255,255,0.9);margin:0 0 15px">VANTAGE</p>
          <p style="font-size:60px;margin:0 0 15px">🎉</p>
          <h1 style="color:#fff;font-size:28px;margin:0">¡Pedido Entregado!</h1>
        </div>
        <div style="padding:40px 30px">
          <p>Hola <strong>Carlos García</strong>,</p>
          <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:2px solid #10b981;border-radius:16px;padding:30px;text-align:center;margin:25px 0">
            <p style="font-size:50px;margin:0 0 15px">✅</p>
            <p style="font-size:20px;font-weight:700;color:#065f46;margin:0 0 10px">¡Entrega completada!</p>
            <p style="font-size:28px;font-weight:700;color:#059669;margin:0">#00123</p>
          </div>
          <div style="background:#f9fafb;border-radius:12px;padding:25px;text-align:center;margin:25px 0">
            <p style="font-size:16px;font-weight:600;margin:0 0 15px">⭐ ¿Te ha gustado tu experiencia?</p>
            <p style="color:#6b7280;margin:0 0 20px">Tu opinión nos ayuda a mejorar.</p>
            <a href="#" style="background:${BRAND.gold};color:${BRAND.navy};padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:700">Dejar una Reseña</a>
          </div>
        </div>
        <div style="background:#f9fafb;padding:30px;text-align:center"><p style="color:#6b7280;font-size:14px;margin:0">© 2026 Vantage</p></div>
      </div>
    </div>`,
    'return-created': `
    <div style="font-family:system-ui;background:#f5f5f5;padding:40px 20px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
        <div style="background:${BRAND.navy};color:#fff;padding:40px;text-align:center">
          <p style="font-size:20px;letter-spacing:0.3em;margin:0 0 15px">VANTAGE</p>
          <h1 style="margin:0;font-weight:400">📦 Tu Devolución Está en Marcha</h1>
        </div>
        <div style="padding:40px">
          <p>Hola <strong>Carlos García</strong>,</p>
          <p>Hemos recibido tu solicitud. Encontrarás adjunto un <strong>PDF con tu etiqueta</strong>.</p>
          <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:25px;text-align:center;margin:25px 0">
            <p style="margin:0 0 5px;color:#166534;font-size:14px">Número de devolución</p>
            <p style="font-size:28px;font-weight:bold;color:#166534;margin:10px 0">RET-00042</p>
          </div>
          <div style="background:linear-gradient(135deg,${BRAND.navy},#2d3a52);border-radius:12px;padding:25px;text-align:center;color:#fff;margin:25px 0">
            <p style="font-size:48px;margin:0 0 10px">📎</p>
            <p style="font-size:18px;font-weight:600;margin:0">Etiqueta adjunta en PDF</p>
            <p style="opacity:0.9;font-size:14px;margin:10px 0 0">Imprímela y pégala en tu paquete</p>
          </div>
          <div style="background:#fef3c7;border-radius:12px;padding:20px;margin:25px 0">
            <p style="margin:0 0 15px;font-weight:600">📋 Pasos:</p>
            <p style="margin:0 0 10px">1. Descarga e imprime el PDF adjunto</p>
            <p style="margin:0 0 10px">2. Empaqueta los artículos</p>
            <p style="margin:0 0 10px">3. Pega la etiqueta en el exterior</p>
            <p style="margin:0">4. Entrega en cualquier oficina de Correos (gratis)</p>
          </div>
        </div>
        <div style="text-align:center;padding:30px;background:#f9fafb"><p style="color:#6b7280;font-size:14px;margin:0">© 2026 Vantage</p></div>
      </div>
    </div>`,
    'return-received': `
    <div style="font-family:system-ui;background:#f5f5f5;padding:40px 20px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
        <div style="background:${BRAND.purple};color:#fff;padding:40px;text-align:center">
          <p style="font-size:20px;letter-spacing:0.3em;margin:0 0 10px;opacity:0.9">VANTAGE</p>
          <p style="font-size:48px;margin:0">📦</p>
          <h1 style="margin:15px 0 0;font-weight:400">¡Hemos recibido tu paquete!</h1>
        </div>
        <div style="padding:40px">
          <p>Hola <strong>Carlos García</strong>,</p>
          <p>Tu devolución llegó a nuestro almacén. Estamos revisando los artículos.</p>
          <div style="background:#f5f3ff;border:2px solid #c4b5fd;border-radius:16px;padding:25px;text-align:center;margin:25px 0">
            <p style="margin:0 0 5px;color:#6b7280;font-size:14px">Número de devolución</p>
            <p style="font-size:24px;font-weight:bold;color:${BRAND.purple};margin:0">RET-00042</p>
            <p style="margin:15px 0 0;font-size:14px;color:#6b7280">Estado: <strong style="color:${BRAND.purple}">En revisión</strong></p>
          </div>
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px 20px;border-radius:0 8px 8px 0;margin:25px 0">
            <p style="margin:0"><strong>⏱️ Plazo de revisión: 2-4 días laborables</strong></p>
            <p style="margin:10px 0 0;font-size:14px">Te enviaremos otro email confirmando el reembolso.</p>
          </div>
        </div>
        <div style="text-align:center;padding:30px;background:#f9fafb"><p style="color:#6b7280;font-size:14px;margin:0">© 2026 Vantage</p></div>
      </div>
    </div>`,
    'refund': `
    <div style="font-family:system-ui;background:#f5f5f5;padding:40px 20px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
        <div style="background:${BRAND.success};color:#fff;padding:40px;text-align:center">
          <p style="font-size:20px;letter-spacing:0.3em;margin:0 0 10px;opacity:0.9">VANTAGE</p>
          <p style="font-size:56px;margin:0">🎉</p>
          <h1 style="margin:15px 0 0;font-weight:400">¡Devolución Completada!</h1>
        </div>
        <div style="padding:40px">
          <p>Hola <strong>Carlos García</strong>,</p>
          <p>¡Buenas noticias! Hemos revisado tu devolución y <strong>todo está correcto</strong>.</p>
          <div style="background:#dcfce7;border:2px solid #86efac;border-radius:16px;padding:30px;text-align:center;margin:25px 0">
            <p style="margin:0 0 5px;color:#166534;font-size:14px">Importe reembolsado</p>
            <p style="font-size:42px;font-weight:bold;color:${BRAND.success};margin:0">149,00 €</p>
            <p style="margin:10px 0 0;font-size:14px;color:#166534">Devolución RET-00042</p>
          </div>
          <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:15px 20px;border-radius:0 8px 8px 0;margin:25px 0">
            <p style="margin:0;font-weight:600">💳 ¿Cuándo recibiré el dinero?</p>
            <p style="margin:10px 0 0;font-size:14px">El importe se abonará en <strong>3-5 días laborables</strong>.</p>
          </div>
          <div style="text-align:center;margin:30px 0">
            <a href="#" style="display:inline-block;background:${BRAND.navy};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600">Seguir Comprando</a>
          </div>
        </div>
        <div style="text-align:center;padding:30px;background:#f9fafb"><p style="color:#6b7280;font-size:14px;margin:0">© 2026 Vantage</p></div>
      </div>
    </div>`,
    'return-rejected': `
    <div style="font-family:system-ui;background:#f5f5f5;padding:40px 20px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
        <div style="background:${BRAND.navy};color:#fff;padding:40px;text-align:center">
          <p style="font-size:20px;letter-spacing:0.3em;margin:0 0 10px;opacity:0.9">VANTAGE</p>
          <h1 style="margin:0;font-weight:400">Actualización de tu devolución</h1>
        </div>
        <div style="padding:40px">
          <p>Hola <strong>Carlos García</strong>,</p>
          <p>Te escribimos respecto a tu solicitud <strong>RET-00042</strong>.</p>
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px 20px;border-radius:0 8px 8px 0;margin:20px 0">
            <p style="margin:0"><strong>Mensaje del equipo:</strong></p>
            <p style="margin:10px 0 0">El producto presenta signos de uso que no permiten procesar la devolución según nuestra política. Te contactaremos para ofrecerte alternativas.</p>
          </div>
          <p>Si tienes alguna pregunta, contáctanos respondiendo a este email.</p>
        </div>
        <div style="text-align:center;padding:30px;background:#f9fafb"><p style="color:#6b7280;font-size:14px;margin:0">© 2026 Vantage</p></div>
      </div>
    </div>`,
    'admin-order': `
    <div style="font-family:system-ui;background:#f0fdf4;padding:40px 20px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
        <div style="background:${BRAND.success};color:#fff;padding:40px;text-align:center">
          <p style="font-size:20px;letter-spacing:0.3em;margin:0 0 15px;opacity:0.9">VANTAGE</p>
          <p style="font-size:60px;margin:0 0 15px">🎉</p>
          <h1 style="margin:0;font-size:24px;font-weight:400">¡Nuevo Pedido!</h1>
          <p style="margin:10px 0 0;opacity:0.9">Corre a prepararlo</p>
        </div>
        <div style="padding:40px">
          <div style="background:#f0fdf4;border-radius:12px;padding:25px;text-align:center;margin:0 0 20px;border:2px solid ${BRAND.success}">
            <p style="margin:0 0 5px;color:#6b7280;font-size:14px">Número de pedido</p>
            <p style="font-size:36px;font-weight:bold;color:${BRAND.success};margin:0">#00123</p>
          </div>
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px 20px;border-radius:0 8px 8px 0;margin:20px 0">
            <strong>⚡ ¡Acción requerida!</strong>
            <p style="margin:10px 0 0;color:#92400e">Este pedido está pagado y esperando.</p>
          </div>
          <div style="margin:25px 0">
            <p><strong>Cliente:</strong> Carlos García</p>
            <p><strong>Email:</strong> carlos@email.com</p>
            <p><strong>Productos:</strong> 3 artículo(s)</p>
            <p><strong style="color:${BRAND.success};font-size:20px">Total: €247,00</strong></p>
          </div>
          <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:25px 0">
            <h3 style="margin:0 0 15px;color:${BRAND.navy};font-size:16px">📦 Productos a Preparar</h3>
            <div style="background:#fff;border-radius:8px;padding:12px;margin-bottom:10px;display:flex;align-items:center;gap:12px">
              <div style="width:60px;height:60px;background:#f3f4f6;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px">👔</div>
              <div style="flex:1"><strong>Chaqueta Premium Navy</strong><br><small style="color:#6b7280">Talla: M · Cantidad: 1</small></div>
              <div style="font-weight:700;color:${BRAND.success}">€149,00</div>
            </div>
          </div>
          <div style="text-align:center"><a href="#" style="display:inline-block;background:${BRAND.navy};color:#fff;padding:16px 40px;border-radius:8px;text-decoration:none;font-weight:bold">Ver Pedido en Admin</a></div>
        </div>
        <div style="text-align:center;padding:30px;background:#f9fafb;color:#6b7280;font-size:14px">Mensaje automático de Vantage</div>
      </div>
    </div>`,
    'admin-return': `
    <div style="font-family:system-ui;background:#f5f5f5;padding:40px 20px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
        <div style="background:#dc2626;color:#fff;padding:30px;text-align:center">
          <h1 style="margin:0;font-size:24px">🔄 Nueva Devolución</h1>
        </div>
        <div style="padding:30px">
          <p><strong>Número:</strong> RET-00042</p>
          <p><strong>Cliente:</strong> Carlos García (carlos@email.com)</p>
          <p><strong>Motivo:</strong> Talla incorrecta</p>
          <div style="background:#fef3c7;border-radius:8px;padding:15px;margin:15px 0">
            <p style="margin:0 0 10px;font-weight:600">Productos:</p>
            <ul style="margin:0;padding-left:20px"><li>Chaqueta Premium Navy (M) × 1</li></ul>
          </div>
          <p>El cliente ya tiene su etiqueta PDF.</p>
          <div style="text-align:center;margin-top:25px"><a href="#" style="display:inline-block;background:${BRAND.navy};color:#fff;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:500">Ver en Panel Admin</a></div>
        </div>
      </div>
    </div>`,
    'stock-low': `
    <div style="font-family:system-ui;background:#f8f5f0;padding:30px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,${BRAND.navy},#2d4a6f);padding:45px 30px;text-align:center">
          <p style="font-size:24px;letter-spacing:0.3em;color:${BRAND.gold};margin:0 0 20px">VANTAGE</p>
          <div style="background:#fef3c7;width:70px;height:70px;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center"><span style="font-size:36px">⚠️</span></div>
          <h1 style="color:#fff;font-size:28px;margin:0">Alerta de Stock Bajo</h1>
          <p style="color:rgba(255,255,255,0.85);font-size:16px;margin:12px 0 0">Sistema de Inventario</p>
        </div>
        <div style="padding:40px 30px">
          <div style="background:#fef3c7;border-left:5px solid #d97706;border-radius:0 12px 12px 0;padding:20px 25px;margin-bottom:30px">
            <p style="margin:0;color:#92400e;font-weight:700;font-size:17px">2 productos con stock bajo</p>
            <p style="margin:10px 0 0;color:#a16207;font-size:15px">Stock igual o inferior a 5 unidades</p>
          </div>
          <div style="background:#f9fafb;border-radius:12px;overflow:hidden;margin-bottom:30px">
            <div style="padding:18px 15px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:15px">
              <div style="flex:1"><p style="margin:0;font-weight:600;color:${BRAND.navy}">Polo Classic White</p><span style="background:#fef3c7;color:#d97706;padding:5px 14px;border-radius:20px;font-weight:700;font-size:13px">3 unidades</span></div>
              <a href="#" style="background:${BRAND.navy};color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Gestionar</a>
            </div>
            <div style="padding:18px 15px;display:flex;align-items:center;gap:15px">
              <div style="flex:1"><p style="margin:0;font-weight:600;color:${BRAND.navy}">Chaqueta Premium Navy (Talla L)</p><span style="background:#fef3c7;color:#d97706;padding:5px 14px;border-radius:20px;font-weight:700;font-size:13px">2 unidades</span></div>
              <a href="#" style="background:${BRAND.navy};color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Gestionar</a>
            </div>
          </div>
          <div style="text-align:center"><a href="#" style="display:block;background:${BRAND.navy};color:#fff;padding:18px 30px;border-radius:12px;text-decoration:none;font-weight:700;font-size:18px">Ir al Panel de Productos</a></div>
        </div>
        <div style="background:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb"><p style="color:#6b7280;font-size:14px;margin:0">© 2026 Vantage. Moda Masculina Premium.</p></div>
      </div>
    </div>`,
    'stock-out': `
    <div style="font-family:system-ui;background:#f8f5f0;padding:30px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:45px 30px;text-align:center">
          <p style="font-size:24px;letter-spacing:0.3em;color:rgba(255,255,255,0.9);margin:0 0 25px">VANTAGE</p>
          <div style="background:rgba(255,255,255,0.2);width:80px;height:80px;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center"><span style="font-size:40px">🚨</span></div>
          <h1 style="color:#fff;font-size:28px;font-weight:700;margin:0">¡Productos Agotados!</h1>
          <p style="color:rgba(255,255,255,0.9);font-size:16px;margin:12px 0 0">Alerta Crítica de Inventario</p>
        </div>
        <div style="padding:40px 30px">
          <div style="background:#fee2e2;border-left:5px solid #dc2626;border-radius:0 12px 12px 0;padding:20px 25px;margin-bottom:30px">
            <p style="margin:0;color:#991b1b;font-weight:700;font-size:17px">¡URGENTE! 1 producto sin stock</p>
            <p style="margin:10px 0 0;color:#b91c1c;font-size:15px">Los clientes no pueden comprar hasta que repongas.</p>
          </div>
          <div style="background:#fef2f2;border-radius:12px;overflow:hidden;margin-bottom:30px">
            <div style="padding:20px;border-bottom:1px solid #fecaca;background:#fff">
              <p style="margin:0 0 10px;font-weight:700;color:#1f2937;font-size:16px">Polo Classic White (Talla S)</p>
              <span style="background:#dc2626;color:#fff;padding:6px 16px;border-radius:20px;font-weight:700;font-size:12px">⛔ AGOTADO</span>
              <div style="margin-top:15px"><a href="#" style="display:block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;text-align:center">Reponer Stock</a></div>
            </div>
          </div>
          <div style="text-align:center"><a href="#" style="display:block;background:#dc2626;color:#fff;padding:18px 30px;border-radius:12px;text-decoration:none;font-weight:700;font-size:18px">Gestionar Inventario Ahora</a></div>
        </div>
        <div style="background:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb"><p style="color:#6b7280;font-size:14px;margin:0">© 2026 Vantage</p></div>
      </div>
    </div>`,
    'wishlist-low': `
    <div style="font-family:system-ui;background:#f8f5f0;padding:30px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,${BRAND.navy},#2d4a6f);padding:45px 30px;text-align:center">
          <p style="font-size:18px;letter-spacing:0.3em;color:${BRAND.gold};margin:0 0 20px">VANTAGE</p>
          <p style="font-size:50px;margin:0 0 15px">❤️</p>
          <h1 style="color:#fff;font-size:28px;margin:0">Tu favorito se está agotando</h1>
          <p style="color:rgba(255,255,255,0.85);font-size:16px;margin:12px 0 0">Quedan pocas unidades</p>
        </div>
        <div style="padding:40px 30px">
          <p style="font-size:18px">Hola <strong style="color:${BRAND.navy}">Carlos</strong>,</p>
          <p style="color:#4b5563;font-size:17px;line-height:1.7">Sabemos que te encanta este producto. <strong>Quedan muy pocas unidades</strong> en tu talla.</p>
          <div style="background:#f9fafb;border-radius:16px;padding:25px;text-align:center;margin:35px 0">
            <div style="width:180px;height:220px;background:#e5e7eb;border-radius:12px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:60px">👔</div>
            <h2 style="font-size:22px;font-weight:600;color:${BRAND.navy};margin:0 0 15px">Chaqueta Premium Navy</h2>
            <p style="margin:0 0 15px"><span style="background:${BRAND.navy};color:#fff;padding:10px 20px;border-radius:8px;font-size:16px;font-weight:600">Talla M</span></p>
            <p style="font-size:28px;font-weight:700;color:${BRAND.navy};margin:0">€149,00</p>
          </div>
          <div style="background:#f0f4f8;border-left:5px solid ${BRAND.navy};border-radius:0 12px 12px 0;padding:20px 25px;margin:35px 0">
            <p style="margin:0;color:${BRAND.navy};font-weight:700;font-size:17px">⏰ ¡Últimas unidades disponibles!</p>
            <p style="margin:10px 0 0;color:#4b5563;font-size:16px">Los productos populares se agotan rápidamente.</p>
          </div>
          <div style="text-align:center"><a href="#" style="display:block;background:${BRAND.navy};color:#fff;padding:18px 30px;border-radius:12px;text-decoration:none;font-weight:700;font-size:18px">Ver Producto</a></div>
        </div>
        <div style="background:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb"><p style="color:#6b7280;font-size:14px;margin:0">© 2026 Vantage</p></div>
      </div>
    </div>`,
    'wishlist-sale': `
    <div style="font-family:system-ui;background:#f8f5f0;padding:30px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,${BRAND.navy},#2d4a6f);padding:45px 30px;text-align:center">
          <p style="font-size:18px;letter-spacing:0.3em;color:${BRAND.gold};margin:0 0 20px">VANTAGE</p>
          <p style="font-size:50px;margin:0 0 15px">🏷️</p>
          <h1 style="color:#fff;font-size:28px;margin:0">¡Tu favorito está en oferta!</h1>
          <p style="color:${BRAND.gold};font-size:24px;font-weight:700;margin:15px 0 0">-20% de descuento</p>
        </div>
        <div style="padding:40px 30px">
          <p style="font-size:18px">Hola <strong style="color:${BRAND.navy}">Carlos</strong>,</p>
          <p style="color:#4b5563;font-size:17px;line-height:1.7">¡Buenas noticias! Un producto de tu lista de deseos acaba de entrar en oferta.</p>
          <div style="background:#f9fafb;border-radius:16px;padding:25px;text-align:center;margin:35px 0;border:3px solid ${BRAND.gold}">
            <p style="background:#dc2626;color:#fff;padding:8px 18px;border-radius:8px;font-size:18px;font-weight:700;display:inline-block;margin:0 0 20px">-20%</p>
            <div style="width:180px;height:220px;background:#e5e7eb;border-radius:12px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:60px">👔</div>
            <h2 style="font-size:22px;font-weight:600;color:${BRAND.navy};margin:0 0 15px">Chaqueta Premium Navy</h2>
            <p style="margin:0 0 15px"><span style="background:${BRAND.navy};color:#fff;padding:10px 20px;border-radius:8px;font-size:16px;font-weight:600">Talla M</span></p>
            <p style="margin:0"><span style="font-size:18px;color:#9ca3af;text-decoration:line-through">€149,00</span> <span style="font-size:32px;font-weight:700;color:#dc2626;margin-left:12px">€119,20</span></p>
          </div>
          <div style="background:#fef2f2;border-left:5px solid #dc2626;border-radius:0 12px 12px 0;padding:20px 25px;margin:35px 0">
            <p style="margin:0;color:#dc2626;font-weight:700;font-size:17px">🔥 Oferta por tiempo limitado</p>
            <p style="margin:10px 0 0;color:#4b5563;font-size:16px">Aprovecha antes de que termine.</p>
          </div>
          <div style="text-align:center"><a href="#" style="display:block;background:#dc2626;color:#fff;padding:18px 30px;border-radius:12px;text-decoration:none;font-weight:700;font-size:18px">Comprar con Descuento</a></div>
        </div>
        <div style="background:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb"><p style="color:#6b7280;font-size:14px;margin:0">© 2026 Vantage</p></div>
      </div>
    </div>`,
    'newsletter': `
    <div style="font-family:system-ui;background:#f5f5f5;padding:40px 20px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
        <div style="background:${BRAND.navy};color:#fff;padding:40px;text-align:center">
          <p style="font-size:28px;font-weight:300;letter-spacing:0.3em;margin:0 0 15px">VANTAGE</p>
          <h1 style="margin:0;font-weight:400">Nueva Colección Primavera</h1>
        </div>
        <div style="padding:40px;font-size:16px">
          <p style="font-size:18px;margin-bottom:25px">Hola <strong>Carlos</strong>,</p>
          <p style="margin:0 0 15px">Descubre las últimas tendencias de la temporada.</p>
          <p style="margin:0 0 15px">Hemos preparado una selección exclusiva de piezas premium para renovar tu armario con elegancia y estilo.</p>
          <p style="margin:0 0 15px">Además, como suscriptor VIP, tienes acceso anticipado a todas las novedades antes que nadie.</p>
          <div style="height:1px;background:#e5e7eb;margin:30px 0"></div>
          <div style="text-align:center"><a href="#" style="display:inline-block;background:${BRAND.navy};color:#fff;padding:16px 40px;border-radius:8px;text-decoration:none;font-weight:500;letter-spacing:0.05em">Visitar la Tienda</a></div>
        </div>
        <div style="text-align:center;padding:30px;background:#f9fafb;color:#6b7280;font-size:12px">
          <p>Has recibido este email porque estás suscrito al newsletter de Vantage.</p>
          <p><a href="#" style="color:${BRAND.navy};text-decoration:none">Gestionar suscripción</a> | <a href="#" style="color:${BRAND.navy};text-decoration:none">Visitar web</a></p>
          <p style="margin-top:20px">© 2026 Vantage. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>`
};

export const GET: APIRoute = async ({ url }) => {
    const type = url.searchParams.get('type') || 'order-confirmation';
    const html = emails[type] || '<p>Email no encontrado</p>';
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};
