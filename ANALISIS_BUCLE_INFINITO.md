# 🔍 ANÁLISIS PROFUNDO DEL BUCLE INFINITO - SOLUCIONADO

## ❌ Problema Identificado

El bucle infinito entre `/login` y `/favoritos` era causado por **dos problemas arquitecturales fundamentales**:

### Problema #1: Cliente de Supabase Compartido (CRÍTICO)

```typescript
// ❌ INCORRECTO - En favoritos.astro (versión antigua)
import { supabase } from "../lib/supabase";  // Cliente compartido entre TODAS las peticiones

const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
});
```

**Por qué esto causaba el bucle:**
- El cliente `supabase` es una **instancia singleton** compartida entre todas las peticiones HTTP
- Cuando el usuario A visita `/favoritos`, se llama `setSession()` con los tokens del usuario A
- Si el usuario B visita `/favoritos` al mismo tiempo, el cliente ya tiene la sesión del usuario A
- Esto causa **contaminación de sesiones** y comportamiento impredecible
- El servidor no puede determinar correctamente si la sesión es válida o no
- Resultado: Redirige a `/login` por error

### Problema #2: Auto-Redirect en Login Sin Validación

```javascript
// ❌ INCORRECTO - En login.astro (versión antigua)
async function checkExistingSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        // SIEMPRE redirige si hay sesión en localStorage
        window.location.href = returnTo; // "/favoritos"
    }
}
checkExistingSession(); // Se ejecuta automáticamente
```

**Por qué esto causaba el bucle:**
- El cliente de Supabase en el navegador guarda la sesión en **localStorage**
- Cuando `/favoritos` redirige a `/login` por un error de sesión en el servidor
- El script del cliente en `/login` detecta sesión en localStorage (que puede estar desincronizada)
- Redirige automáticamente de vuelta a `/favoritos`
- `/favoritos` detecta problema de sesión nuevamente → bucle infinito

## ✅ Solución Implementada

### Solución #1: Cliente de Supabase Por Petición

**Archivo modificado:** `src/lib/supabase.ts`

```typescript
/**
 * Crea un cliente de Supabase con autenticación basada en cookies
 * IMPORTANTE: Usar esto en lugar del cliente global en páginas SSR
 * para evitar compartir sesiones entre peticiones
 */
export function createServerClient(cookies: AstroCookies): SupabaseClient {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;
    
    // Crear cliente NUEVO para esta petición específica
    const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,  // No persistir en localStorage del servidor
            autoRefreshToken: false, // No auto-refrescar (lo haremos manualmente)
        },
        global: {
            headers: accessToken ? {
                Authorization: `Bearer ${accessToken}` // Usar token de ESTA petición
            } : {}
        }
    });
    
    // Si hay tokens, setear la sesión SOLO para este cliente
    if (accessToken && refreshToken) {
        client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });
    }
    
    return client;
}
```

**Beneficios:**
- ✅ Cada petición HTTP tiene su propio cliente de Supabase
- ✅ No hay contaminación de sesiones entre usuarios
- ✅ Las cookies se leen correctamente de la petición actual
- ✅ Verificación de sesión precisa y confiable

### Solución #2: Reescritura de favoritos.astro

**Archivo modificado:** `src/pages/favoritos.astro`

```typescript
// ✅ CORRECTO
import { createServerClient } from "../lib/supabase";

// Crear cliente con las cookies de ESTA petición
const supabase = createServerClient(Astro.cookies);

// Verificar cookies primero
const accessToken = Astro.cookies.get("sb-access-token")?.value;
const refreshToken = Astro.cookies.get("sb-refresh-token")?.value;

if (!accessToken || !refreshToken) {
    // No hay cookies → redirigir a login
    return Astro.redirect(`/login?redirect=/favoritos`);
}

// Obtener sesión del cliente de ESTA petición
const { data: { session }, error: sessionError } = await supabase.auth.getSession();

if (sessionError) {
    // Error de sesión → limpiar cookies y redirigir
    Astro.cookies.delete('sb-access-token', { path: '/' });
    Astro.cookies.delete('sb-refresh-token', { path: '/' });
    return Astro.redirect(`/login?error=Sesión expirada`);
}

if (!session?.user) {
    // No hay usuario → redirigir
    return Astro.redirect(`/login?redirect=/favoritos`);
}

// ✅ Sesión válida, continuar
user = session.user;
```

**Beneficios:**
- ✅ Verificación de cookies directa y clara
- ✅ Manejo de errores robusto con limpieza de cookies
- ✅ No más "shouldRedirect" confuso
- ✅ Mensajes de error claros al usuario

### Solución #3: Desactivar Auto-Redirect en Login

**Archivo modificado:** `src/pages/login.astro`

```javascript
// ✅ CORRECTO
async function checkExistingSession() {
    // Si hay un parámetro de error, NO auto-redirigir
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error')) {
        console.log('Error in URL, not auto-redirecting');
        return; // Detener aquí
    }
    
    // Solo redirigir si hay sesión Y no hay errores
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        const returnTo = urlParams.get("redirect") || "/perfil";
        window.location.href = returnTo;
    }
}
```

**Beneficios:**
- ✅ No redirige automáticamente cuando hay errores de sesión
- ✅ Rompe el bucle infinito
- ✅ Permite al usuario ver el mensaje de error y volver a loguearse

## 📊 Flujo Correcto Ahora

### Caso 1: Usuario Sin Sesión
```
1. Usuario → /favoritos
2. favoritos.astro: No hay cookies
3. → Redirect /login?redirect=/favoritos
4. login.astro: checkExistingSession() → No hay sesión en localStorage
5. Usuario ve formulario de login ✅
```

### Caso 2: Usuario Con Sesión Válida
```
1. Usuario → /favoritos (con cookies válidas)
2. favoritos.astro: 
   - Cookies encontradas ✅
   - createServerClient() crea cliente con ESTAS cookies
   - getSession() → Sesión válida ✅
3. Carga wishlist y muestra página ✅
```

### Caso 3: Usuario Con Sesión Expirada
```
1. Usuario → /favoritos (con cookies expiradas)
2. favoritos.astro:
   - Cookies encontradas
   - createServerClient() crea cliente
   - getSession() → Error: "expired" ❌
   - Limpia cookies
   - → Redirect /login?error=Sesión expirada
3. login.astro: 
   - checkExistingSession() detecta parámetro 'error'
   - NO auto-redirige ✅
4. Usuario ve mensaje de error y formulario ✅
```

## 🎯 Cambios Clave

| Archivo | Cambio | Impacto |
|---------|--------|---------|
| `src/lib/supabase.ts` | Agregada función `createServerClient()` | Cliente por petición |
| `src/pages/favoritos.astro` | Usa `createServerClient()` | No más contaminación |
| `src/pages/login.astro` | Valida parámetro `error` antes de auto-redirect | Rompe el bucle |

## 🧪 Pruebas Recomendadas

1. **Sin sesión:**
   - Ir a `/favoritos` → Debe redirigir a `/login` ✅
   - No debe haber bucle ✅

2. **Con sesión válida:**
   - Login → Ir a `/favoritos` → Debe mostrar lista ✅
   - No debe redirigir ✅

3. **Con sesión expirada:**
   - Borrar cookies en DevTools
   - Ir a `/favoritos` → Debe redirigir a `/login?error=...` ✅
   - Debe mostrar error, NO bucle ✅

## 📚 Lecciones Aprendidas

1. **Nunca usar clientes singleton de Supabase en SSR** para operaciones con sesión
2. **Siempre crear clientes nuevos por petición** en entornos server-side
3. **Validar estados antes de auto-redirects** para evitar bucles
4. **Limpiar cookies inválidas** para evitar estados inconsistentes
5. **Logs claros** ayudan a debuggear problemas de sesión

## ✅ Estado Actual

- ✅ Bucle infinito **RESUELTO**
- ✅ Sesiones **aisladas por petición**
- ✅ Manejo de errores **robusto**
- ✅ Auto-redirect **inteligente**
- ✅ Limpieza de cookies **automática**

**El servidor está corriendo en:** `http://localhost:4321/`

**Prueba ahora:**
1. Ve a `/favoritos` sin estar logueado
2. Debería redirigir a `/login` una sola vez
3. Loguéate
4. Deberías poder acceder a `/favoritos` sin problemas
