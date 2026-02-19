# FashionShop / Vantage — Documento base para presentación

## 1) Resumen ejecutivo
**FashionShop (Vantage)** es una plataforma e-commerce full-stack de moda con enfoque en:
- experiencia de compra cuidada,
- operaciones internas eficientes,
- automatización de comunicación con clientes,
- control comercial en tiempo real desde un panel de administración completo.

El proyecto está diseñado para funcionar con alta autonomía operativa: gran parte del día a día (catálogo, pedidos, devoluciones, facturas, cupones, newsletter, alertas) se gestiona sin depender de desarrollo.

---

## 2) Propuesta de valor
- **Para cliente final**: compra simple, perfil con seguimiento, wishlist activa y mensajes claros de interacción.
- **Para negocio**: control centralizado de operación, inventario por tallas, gestión de campañas y automatizaciones.
- **Para escalabilidad**: arquitectura preparada para crecer con backend cloud (Supabase), pagos (Stripe) y workflows programados.

---

## 3) Stack y arquitectura
- **Frontend**: Astro + componentes interactivos (islands), Tailwind.
- **Backend/API**: rutas API en Astro server.
- **Base de datos y auth**: Supabase (PostgreSQL + autenticación).
- **Pagos**: Stripe.
- **Emails**: integración de envío de correos transaccionales y de marketing.
- **Automatización**: GitHub Actions para tareas recurrentes de notificación.

Arquitectura orientada a separar:
- experiencia pública de tienda,
- lógica de negocio en APIs,
- operación interna en panel admin,
- automatizaciones desacopladas por workflow.

---

## 4) Panel Admin (punto fuerte del proyecto)
El panel de administración es una de las piezas más completas y estratégicas del sistema.

### Módulos disponibles
- **Dashboard** (`/admin`): visión ejecutiva con métricas de inventario/actividad.
- **Productos** (`/admin/productos`): alta, edición, stock y media.
- **Categorías** (`/admin/categorias`): organización comercial del catálogo.
- **Tallas** (`/admin/tallas`): control de inventario por talla (clave para moda).
- **Pedidos** (`/admin/pedidos`): gestión operativa de estados y flujo logístico.
- **Devoluciones** (`/admin/devoluciones`): circuito de revisión y resolución.
- **Facturas** (`/admin/facturas`): consulta y gestión documental de facturación.
- **Usuarios** (`/admin/usuarios`): seguimiento de clientes y comportamiento.
- **Cupones** (`/admin/cupones`): creación y control de promociones.
- **Newsletter** (`/admin/newsletter`): campañas y comunicación directa.
- **Configuración** (`/admin/configuracion`): parámetros globales de negocio.

### Por qué aporta autonomía real
- Reduce dependencia de desarrollo para tareas del día a día.
- Permite reacción rápida ante stock, incidencias de pedidos y campañas.
- Unifica datos comerciales y operativos en una sola consola.
- Facilita continuidad operativa incluso con cambios de equipo.

---

## 5) Wishlist (diferenciador funcional)
La wishlist no es solo “guardar favoritos”, está conectada con automatizaciones y valor de negocio.

### Capacidades implementadas
- Añadir/quitar productos favoritos por usuario.
- Vista dedicada en `/favoritos` con gestión de items.
- Integración en la experiencia de producto (interacción directa).
- Persistencia y consulta de wishlist por usuario en Supabase.

### Valor comercial
- Recuperación de intención de compra.
- Re-engagement automático cuando hay:
  - bajo stock de un favorito,
  - entrada en oferta de un favorito.

Esto convierte la wishlist en un canal activo de conversión, no pasivo.

---

## 6) Workflow de automatización (GitHub Actions)
Archivo: `.github/workflows/wishlist-notifications.yml`

### Qué hace
Ejecuta diariamente (y también bajo demanda) dos procesos:
1. **Notificaciones de wishlist por bajo stock**
2. **Notificaciones de wishlist por oferta**

Llama a:
- `/api/admin/wishlist-notifications`
- `/api/admin/wishlist-sale-notifications`

### Cómo funciona (flujo)
1. Valida secretos críticos (`SITE_URL`, `ADMIN_API_KEY`).
2. Valida formato de URL y normaliza endpoint base.
3. Ejecuta llamadas HTTP con autenticación Bearer.
4. Reintenta automáticamente hasta 3 veces si hay fallo.
5. Verifica éxito real por código HTTP y por JSON (`success`).
6. Si falla, **el job falla** (visibilidad inmediata).
7. Si funciona, publica resumen en `GITHUB_STEP_SUMMARY` con contadores.

### Robustez actual
El workflow se dejó endurecido con:
- `timeout-minutes`,
- `concurrency` para evitar solapamientos,
- manejo estricto de errores,
- resumen final auditable.

Resultado: automatización confiable para producción y monitorizable.

---

## 7) Experiencia y comunicación con cliente
Se reforzó la capa de interacción para evitar mensajes técnicos y mejorar UX:
- mensajes visuales consistentes,
- confirmaciones claras en acciones sensibles,
- comunicación más comprensible para usuario final.

Impacto:
- menos fricción en procesos (registro, pedidos, devoluciones, favoritos),
- mayor confianza y claridad en la interacción.

---

## 8) Casos de uso clave (demo en presentación)
1. **Cliente** añade producto a favoritos.
2. **Admin** marca producto en oferta o se detecta stock bajo.
3. **Workflow** ejecuta automatización.
4. **Cliente** recibe notificación relevante.
5. **Cliente** vuelve y convierte (compra).

Segundo caso:
1. **Admin** gestiona pedido/devolución/factura desde panel.
2. Estado actualizado de forma centralizada.
3. Operación trazable y más autónoma.

---

## 9) KPI sugeridos para enseñar en la presentación
- % de tareas operativas resueltas sin soporte técnico.
- Tiempo medio de gestión de pedido/devolución.
- Número de notificaciones wishlist enviadas por día/semana.
- Tasa de retorno desde notificaciones wishlist.
- Conversión de usuarios con wishlist vs sin wishlist.

---

## 10) Conclusión
FashionShop destaca por combinar:
- **experiencia de compra**,
- **panel admin muy completo**,
- **automatización robusta**,
- **wishlist conectada a negocio**.

No es solo una tienda online: es una plataforma operativa preparada para escalar y funcionar con autonomía.

---

## 11) Guion breve para presentar (2–3 minutos)
1. Problema: una tienda necesita vender y operar rápido sin depender siempre de desarrollo.
2. Solución: FashionShop integra tienda + panel admin + automatización.
3. Diferencial: wishlist activa y automatizada (stock/oferta) que impulsa conversión.
4. Fortaleza operativa: admin centraliza catálogo, pedidos, devoluciones, facturas, cupones y campañas.
5. Cierre: plataforma robusta, mantenible y enfocada a resultados de negocio.
