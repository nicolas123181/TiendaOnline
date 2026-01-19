---
description: Setup GitHub Actions for wishlist email notifications
---

# Configurar Notificaciones Automáticas de Wishlist

Este workflow envía emails automáticos a usuarios cuando sus productos favoritos tienen stock bajo o entran en oferta.

## Requisitos Previos

1. **La aplicación debe estar desplegada** en un hosting (Vercel, Railway, Render, etc.)
2. Los endpoints deben ser accesibles públicamente

## Configuración de Secrets en GitHub

Ve a tu repositorio en GitHub → Settings → Secrets and variables → Actions → New repository secret

Añade los siguientes secrets:

### 1. SITE_URL (Obligatorio)
La URL de tu aplicación desplegada.

**Ejemplo:**
```
https://tu-tienda.vercel.app
```

### 2. ADMIN_API_KEY (Opcional pero recomendado)
Una clave secreta para proteger los endpoints de admin.

**Para generarla:**
```bash
# En PowerShell:
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString()))
```

**Luego añádela a tu `.env`:**
```
ADMIN_API_KEY=tu-clave-generada
```

## El Workflow

El archivo `.github/workflows/wishlist-notifications.yml` ejecuta:

1. **Todos los días a las 9:00 AM (hora España)**
2. **Envía notificaciones de stock bajo**: Productos con < 9 unidades
3. **Envía notificaciones de ofertas**: Productos que entraron en rebaja

## Ejecución Manual

Puedes ejecutar el workflow manualmente:

1. Ve a GitHub → Actions → "Wishlist Email Notifications"
2. Click "Run workflow"

## Verificar que Funciona

### Probar localmente (servidor encendido):
```powershell
# Stock bajo
Invoke-RestMethod -Uri "http://localhost:4321/api/admin/wishlist-notifications" -Method POST

# Ofertas
Invoke-RestMethod -Uri "http://localhost:4321/api/admin/wishlist-sale-notifications" -Method POST
```

### Probar en producción:
```powershell
# Stock bajo
Invoke-RestMethod -Uri "https://tu-dominio.com/api/admin/wishlist-notifications" -Method POST -Headers @{Authorization="Bearer TU_API_KEY"}
```

## Notas Importantes

- ⚠️ Si el servidor no está online, las notificaciones NO se envían
- ✅ Cada usuario solo recibe 1 email por tipo de notificación (no spam)
- ✅ Si un producto vuelve a entrar en oferta, se vuelve a notificar
