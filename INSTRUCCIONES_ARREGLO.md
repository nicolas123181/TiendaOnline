# 🔧 INSTRUCCIONES PARA ARREGLAR EL ERROR DE "ready_for_pickup"

## ❌ Error que estabas recibiendo:
```
Error updating order: {
  code: '23514',
  message: 'new row for relation "orders" violates check constraint "orders_status_check"'
}
```

## ✅ Solución

### Paso 1: Ejecutar el script SQL en Supabase

1. Ve a tu **Supabase Dashboard**: https://app.supabase.com
2. Selecciona tu proyecto de FashionShop
3. En el menú lateral, haz clic en **SQL Editor**
4. Crea una nueva query
5. Copia y pega el contenido del archivo `sql/fix_ready_for_pickup_status.sql`:

```sql
-- Eliminar el constraint existente
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Crear nuevo constraint con 'ready_for_pickup' incluido
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'paid', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled'));
```

6. Haz clic en **Run** o presiona `Ctrl+Enter`
7. Deberías ver el mensaje: "Success. No rows returned"

### Paso 2: Verificar que funciona

Ejecuta esta query para verificar que el constraint está actualizado:

```sql
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'orders_status_check';
```

Deberías ver que ahora incluye 'ready_for_pickup' en la lista de valores permitidos.

### Paso 3: Probar en la aplicación

1. Reinicia tu servidor de desarrollo si está corriendo
2. Ve a `/admin/pedidos`
3. Intenta marcar un pedido como "Listo para Recoger"
4. ¡Ahora debería funcionar sin errores! ✅

## 📝 Otros cambios implementados

### ✅ Mejoras en la gestión de pedidos:

1. **Buscador por ID**: Ahora puedes buscar pedidos específicos por su número
2. **Pedidos ordenados correctamente**: Los pedidos de recogida en tienda se muestran del más antiguo al más reciente (FIFO = mejor servicio al cliente)
3. **Clasificación mejorada**: Los pedidos de recogida en tienda se detectan correctamente
4. **Sección separada**: Los pedidos completados (enviados/entregados) ahora están en una sección propia con filtros específicos

### ✅ Arreglado el bug del wishlist:

El problema del bucle infinito en `/favoritos` estaba en que no se manejaban correctamente los errores de sesión. Ahora se maneja con un try-catch que evita el bucle.

## 🎯 Resumen de archivos modificados:

- ✅ `supabase-schema.sql` - Schema actualizado con 'ready_for_pickup'
- ✅ `sql/fix_ready_for_pickup_status.sql` - Script de migración
- ✅ `src/pages/admin/pedidos.astro` - Mejoras en ordenamiento y filtros
- ✅ `src/pages/favoritos.astro` - Arreglado bucle infinito

## 🚀 Próximos pasos:

Una vez ejecutes el script SQL en Supabase, todo debería funcionar correctamente. Si tienes algún problema, revisa:

1. Que el script SQL se ejecutó sin errores
2. Que reiniciaste el servidor de desarrollo
3. Que no hay errores en la consola del navegador

¡Listo! Ahora puedes gestionar tus pedidos sin problemas 🎉
