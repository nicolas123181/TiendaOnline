import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Cliente público para operaciones del lado del cliente
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Verificar si Supabase está configurado correctamente
export const isSupabaseConfigured = Boolean(
    import.meta.env.PUBLIC_SUPABASE_URL &&
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY &&
    !import.meta.env.PUBLIC_SUPABASE_URL.includes('placeholder')
);

/**
 * Crea un cliente de Supabase con autenticación basada en cookies
 * IMPORTANTE: Usar esto en lugar del cliente global en páginas SSR
 * para evitar compartir sesiones entre peticiones
 */
export function createServerClient(cookies: AstroCookies): SupabaseClient {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;
    
    const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        global: {
            headers: accessToken ? {
                Authorization: `Bearer ${accessToken}`
            } : {}
        }
    });
    
    // Si hay tokens, setear la sesión
    if (accessToken && refreshToken) {
        client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });
    }
    
    return client;
}

// Cliente con service role para operaciones admin (solo server-side)
export function getServiceSupabase(): SupabaseClient {
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
    if (!serviceRoleKey || serviceRoleKey === 'placeholder-key' || serviceRoleKey === 'your-service-role-key-here') {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured. Set a valid service role key in .env and restart the server.');
    }
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

// Tipos de base de datos
export interface Category {
    id: number;
    name: string;
    slug: string;
    description?: string;
    created_at: string;
}

export interface Product {
    id: number;
    name: string;
    slug: string;
    description: string;
    price: number; // En céntimos
    sale_price?: number | null; // Precio de oferta en céntimos
    is_on_sale?: boolean; // Si está en oferta flash
    sale_ends_at?: string | null; // Fecha de fin de oferta
    stock: number;
    category_id: number;
    images: string[];
    featured: boolean;
    created_at: string;
    updated_at: string;
    category?: Category;
}

export interface Order {
    id: number;
    customer_email: string;
    customer_name: string;
    customer_address: string;
    customer_city: string;
    customer_postal_code: string;
    customer_phone?: string;
    status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
    total: number;
    stripe_payment_intent_id?: string;
    created_at: string;
    updated_at: string;
}

export interface OrderItem {
    id: number;
    order_id: number;
    product_id: number;
    product_name: string;
    product_price: number;
    quantity: number;
    size?: string;
}

export interface ProductSize {
    id: number;
    product_id: number;
    size: string;
    stock: number;
    created_at: string;
    updated_at: string;
}

// Tipo para manejar stock por tallas en formularios
export interface SizeStock {
    size: string;
    stock: number;
}

export interface AppSettings {
    id: number;
    key: string;
    value: string;
    updated_at: string;
}

// Funciones helper para productos
export async function getProducts(): Promise<Product[]> {
    if (!isSupabaseConfigured) return [];

    try {
        const { data, error } = await supabase
            .from('products')
            .select('*, category:categories(*)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching products:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error fetching products:', e);
        return [];
    }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
    const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(*)')
        .eq('slug', slug)
        .single();

    if (error) return null;
    return data;
}

export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
    const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', categorySlug)
        .single();

    if (!category) return [];

    const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(*)')
        .eq('category_id', category.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching products by category:', error);
        return [];
    }
    return data || [];
}

export async function getFeaturedProducts(): Promise<Product[]> {
    if (!isSupabaseConfigured) return [];

    try {
        const { data, error } = await supabase
            .from('products')
            .select('*, category:categories(*)')
            .eq('featured', true)
            .order('created_at', { ascending: false })
            .limit(8);

        if (error) {
            console.error('Error fetching featured products:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error fetching featured products:', e);
        return [];
    }
}

// ====== FUNCIONES DE STOCK POR TALLAS ======

export async function getProductSizes(productId: number): Promise<ProductSize[]> {
    if (!isSupabaseConfigured) return [];

    try {
        const { data, error } = await supabase
            .from('product_sizes')
            .select('*')
            .eq('product_id', productId)
            .order('size');

        if (error) {
            console.error('Error fetching product sizes:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error fetching product sizes:', e);
        return [];
    }
}

export async function updateProductSizes(productId: number, sizes: SizeStock[]): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    try {
        // Primero eliminamos las tallas existentes
        const { error: deleteError } = await supabase
            .from('product_sizes')
            .delete()
            .eq('product_id', productId);

        if (deleteError) {
            console.error('Error deleting old sizes:', deleteError);
            return false;
        }

        // Luego insertamos las nuevas tallas (solo las que tienen stock > 0 o todas)
        const sizesToInsert = sizes.map(s => ({
            product_id: productId,
            size: s.size,
            stock: s.stock
        }));

        if (sizesToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('product_sizes')
                .insert(sizesToInsert);

            if (insertError) {
                console.error('Error inserting sizes:', insertError);
                return false;
            }
        }

        // El trigger de la BD actualizará automáticamente el stock total en products
        return true;
    } catch (e) {
        console.error('Error updating product sizes:', e);
        return false;
    }
}

export async function getStockForSize(productId: number, size: string): Promise<number> {
    if (!isSupabaseConfigured) return 0;

    try {
        const { data, error } = await supabase
            .from('product_sizes')
            .select('stock')
            .eq('product_id', productId)
            .eq('size', size)
            .single();

        if (error || !data) return 0;
        return data.stock;
    } catch (e) {
        return 0;
    }
}

export async function decrementSizeStock(productId: number, size: string, quantity: number): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    try {
        // Usar la función de base de datos para evitar race conditions
        const { data, error } = await supabase
            .rpc('decrement_size_stock', {
                p_product_id: productId,
                p_size: size,
                p_quantity: quantity
            });

        if (error) {
            console.error('Error decrementing size stock:', error);
            return false;
        }
        return data === true;
    } catch (e) {
        console.error('Error decrementing size stock:', e);
        return false;
    }
}

// Funciones helper para categorías
export async function getCategories(): Promise<Category[]> {
    if (!isSupabaseConfigured) return [];

    try {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name');

        if (error) {
            console.error('Error fetching categories:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error fetching categories:', e);
        return [];
    }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error) return null;
    return data;
}

// Funciones para configuración (ofertas flash switch)
export async function getSetting(key: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .single();

    if (error) return null;
    return data?.value || null;
}

export async function isFlashOffersEnabled(): Promise<boolean> {
    const value = await getSetting('flash_offers_enabled');
    return value === 'true';
}

// ====== FUNCIONES DE AUTENTICACIÓN ======

export async function signOut() {
    return await supabase.auth.signOut();
}

export async function getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user || null;
}

export async function isUserAdmin(email: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('role')
            .eq('email', email)
            .single();

        return !error && data !== null;
    } catch (e) {
        return false;
    }
}

// ====== FUNCIONES DE PEDIDOS ======

export async function getOrders(): Promise<(Order & { items?: OrderItem[] })[]> {
    if (!isSupabaseConfigured) return [];

    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error fetching orders:', e);
        return [];
    }
}

export async function getOrderById(id: number): Promise<(Order & { items?: OrderItem[] }) | null> {
    if (!isSupabaseConfigured) return null;

    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', id)
            .single();

        if (error) return null;
        return data;
    } catch (e) {
        return null;
    }
}

export async function updateOrderStatus(
    orderId: number,
    status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled',
    paymentIntentId?: string
): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    try {
        const updateData: any = {
            status,
            updated_at: new Date().toISOString()
        };

        if (paymentIntentId) {
            updateData.stripe_payment_intent_id = paymentIntentId;
        }

        const { error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId);

        if (error) {
            console.error('Error updating order:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error updating order:', e);
        return false;
    }
}

export async function createOrder(orderData: Omit<Order, 'id' | 'created_at' | 'updated_at'> & { items: Omit<OrderItem, 'id' | 'order_id'>[] }): Promise<Order | null> {
    if (!isSupabaseConfigured) return null;

    try {
        // Crear el pedido
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                customer_email: orderData.customer_email,
                customer_name: orderData.customer_name,
                customer_address: orderData.customer_address,
                customer_city: orderData.customer_city,
                customer_postal_code: orderData.customer_postal_code,
                customer_phone: orderData.customer_phone,
                status: orderData.status || 'pending',
                total: orderData.total,
            })
            .select()
            .single();

        if (orderError || !order) {
            console.error('Error creating order:', orderError);
            return null;
        }

        // Crear items del pedido
        const orderItems = orderData.items.map(item => ({
            ...item,
            order_id: order.id,
        }));

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            console.error('Error creating order items:', itemsError);
            return null;
        }

        return order;
    } catch (e) {
        console.error('Error creating order:', e);
        return null;
    }
}

// ====== FUNCIONES DE PRODUCTOS (Admin) ======

export async function updateProductStock(productId: number, newStock: number): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    try {
        const { error } = await supabase
            .from('products')
            .update({ stock: newStock, updated_at: new Date().toISOString() })
            .eq('id', productId);

        if (error) {
            console.error('Error updating stock:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error updating stock:', e);
        return false;
    }
}

export async function createProduct(productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product | null> {
    if (!isSupabaseConfigured) return null;

    try {
        const { data, error } = await supabase
            .from('products')
            .insert(productData)
            .select()
            .single();

        if (error) {
            console.error('Error creating product:', error);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Error creating product:', e);
        return null;
    }
}

export async function updateProduct(productId: number, productData: Partial<Product>): Promise<Product | null> {
    if (!isSupabaseConfigured) return null;

    try {
        const { data, error } = await supabase
            .from('products')
            .update({ ...productData, updated_at: new Date().toISOString() })
            .eq('id', productId)
            .select()
            .single();

        if (error) {
            console.error('Error updating product:', error);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Error updating product:', e);
        return null;
    }
}

export async function deleteProduct(productId: number): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    try {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId);

        if (error) {
            console.error('Error deleting product:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error deleting product:', e);
        return false;
    }
}

// ====== FUNCIONES DE ENVÍO ======

export async function getShippingMethods(): Promise<ShippingMethod[]> {
    if (!isSupabaseConfigured) return [];

    try {
        const { data, error } = await supabase
            .from('shipping_methods')
            .select('*')
            .eq('is_active', true)
            .order('display_order');

        if (error) {
            console.error('Error fetching shipping methods:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error fetching shipping methods:', e);
        return [];
    }
}

export interface ShippingMethod {
    id: number;
    name: string;
    description?: string;
    cost: number;
    min_days: number;
    max_days: number;
    min_order_amount?: number;
    max_weight_grams?: number;
    is_active: boolean;
    display_order: number;
    created_at: string;
}

// ====== FUNCIONES DE CUPONES ======

export interface Coupon {
    id: number;
    code: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    max_uses?: number;
    used_count: number;
    min_purchase?: number;
    start_date: string;
    end_date?: string;
    is_active: boolean;
    created_at: string;
}

export async function validateCoupon(code: string, orderTotal: number, userEmail?: string): Promise<{ valid: boolean; discount: number; message: string; couponId?: number }> {
    if (!isSupabaseConfigured) {
        return { valid: false, discount: 0, message: 'Sistema no configurado' };
    }

    try {
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('code', code.toUpperCase())
            .eq('is_active', true)
            .single();

        if (error || !data) {
            return { valid: false, discount: 0, message: 'Cupón no encontrado o no válido' };
        }

        const now = new Date().toISOString();

        // Validar fechas
        if (new Date(data.start_date) > new Date(now)) {
            return { valid: false, discount: 0, message: 'Este cupón no está disponible aún' };
        }

        if (data.end_date && new Date(data.end_date) < new Date(now)) {
            return { valid: false, discount: 0, message: 'Este cupón ha expirado' };
        }

        // Validar límite de usos TOTAL
        if (data.max_uses && data.used_count >= data.max_uses) {
            return { valid: false, discount: 0, message: 'Este cupón ya no está disponible' };
        }

        // Validar límite de usos POR USUARIO
        if (data.max_uses_per_user && userEmail) {
            // Contar cuántas veces este usuario ha usado este cupón
            const { count, error: usageError } = await supabase
                .from('coupon_usage')
                .select('*', { count: 'exact', head: true })
                .eq('coupon_id', data.id)
                .eq('customer_email', userEmail);

            if (!usageError && count !== null && count >= data.max_uses_per_user) {
                return { valid: false, discount: 0, message: `Ya has usado este cupón ${data.max_uses_per_user} ${data.max_uses_per_user === 1 ? 'vez' : 'veces'}` };
            }
        }

        // Validar compra mínima
        if (data.min_purchase && orderTotal < data.min_purchase) {
            return { valid: false, discount: 0, message: `Compra mínima de ${(data.min_purchase / 100).toFixed(2)}€ requerida` };
        }

        // Calcular descuento
        let discount = 0;
        if (data.discount_type === 'percentage') {
            discount = Math.floor(orderTotal * (data.discount_value / 100));
        } else {
            discount = Math.min(data.discount_value, orderTotal);
        }

        return { valid: true, discount, message: 'Cupón aplicado correctamente', couponId: data.id };
    } catch (e) {
        console.error('Error validating coupon:', e);
        return { valid: false, discount: 0, message: 'Error al validar el cupón' };
    }
}

// ====== FUNCIONES DE OFERTAS ======

export interface ProductOffer {
    id: number;
    product_id: number;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    original_price: number;
    sale_price: number;
    start_date: string;
    end_date?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export async function getProductOffer(productId: number): Promise<ProductOffer | null> {
    if (!isSupabaseConfigured) return null;

    try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('product_offers')
            .select('*')
            .eq('product_id', productId)
            .eq('is_active', true)
            .lte('start_date', now)
            .or(`end_date.is.null,end_date.gte.${now}`)
            .single();

        if (error || !data) return null;
        return data;
    } catch (e) {
        return null;
    }
}

// =====================================================
// WISHLIST / LISTA DE DESEOS
// =====================================================

export interface WishlistItem {
    id: number;
    user_id: string;
    product_id: number;
    size: string;
    notified_low_stock: boolean;
    created_at: string;
}

export interface WishlistItemWithProduct extends WishlistItem {
    product?: Product;
    size_stock?: number;
}

/**
 * Añadir producto a la lista de deseos
 */
export async function addToWishlist(
    userId: string,
    productId: number,
    size: string
): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    try {
        const { error } = await supabase
            .from('wishlist')
            .insert({
                user_id: userId,
                product_id: productId,
                size: size
            });

        if (error) {
            // Si ya existe, no es un error grave
            if (error.code === '23505') {
                console.log('Item already in wishlist');
                return true;
            }
            console.error('Error adding to wishlist:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error adding to wishlist:', e);
        return false;
    }
}

/**
 * Quitar producto de la lista de deseos
 */
export async function removeFromWishlist(
    userId: string,
    productId: number,
    size: string
): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    try {
        const { error } = await supabase
            .from('wishlist')
            .delete()
            .eq('user_id', userId)
            .eq('product_id', productId)
            .eq('size', size);

        if (error) {
            console.error('Error removing from wishlist:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error removing from wishlist:', e);
        return false;
    }
}

/**
 * Toggle wishlist item (añadir si no existe, quitar si existe)
 */
export async function toggleWishlist(
    userId: string,
    productId: number,
    size: string
): Promise<{ isInWishlist: boolean; success: boolean }> {
    if (!isSupabaseConfigured) return { isInWishlist: false, success: false };

    try {
        // Verificar si ya está en wishlist
        const isIn = await isInWishlist(userId, productId, size);

        if (isIn) {
            const success = await removeFromWishlist(userId, productId, size);
            return { isInWishlist: false, success };
        } else {
            const success = await addToWishlist(userId, productId, size);
            return { isInWishlist: true, success };
        }
    } catch (e) {
        console.error('Error toggling wishlist:', e);
        return { isInWishlist: false, success: false };
    }
}

/**
 * Verificar si un producto+talla está en la wishlist del usuario
 */
export async function isInWishlist(
    userId: string,
    productId: number,
    size: string
): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    try {
        const { data, error } = await supabase
            .from('wishlist')
            .select('id')
            .eq('user_id', userId)
            .eq('product_id', productId)
            .eq('size', size)
            .single();

        return !error && !!data;
    } catch (e) {
        return false;
    }
}

/**
 * Obtener toda la wishlist del usuario con detalles de producto
 */
export async function getUserWishlist(userId: string): Promise<WishlistItemWithProduct[]> {
    if (!isSupabaseConfigured) return [];

    try {
        const { data, error } = await supabase
            .from('wishlist')
            .select(`
                *,
                product:products(*)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error || !data) return [];

        // Obtener stock por talla para cada item
        const itemsWithStock = await Promise.all(data.map(async (item: any) => {
            const sizeStock = await getStockForSize(item.product_id, item.size);
            return {
                ...item,
                size_stock: sizeStock
            };
        }));

        return itemsWithStock;
    } catch (e) {
        console.error('Error getting user wishlist:', e);
        return [];
    }
}

/**
 * Obtener el conteo de items en la wishlist del usuario
 */
export async function getWishlistCount(userId: string): Promise<number> {
    if (!isSupabaseConfigured) return 0;

    try {
        const { count, error } = await supabase
            .from('wishlist')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (error) return 0;
        return count || 0;
    } catch (e) {
        return 0;
    }
}

/**
 * Obtener items de wishlist que tienen stock bajo para notificar
 */
export interface WishlistLowStockNotification {
    wishlist_id: number;
    user_id: string;
    user_email: string;
    user_name: string;
    product_id: number;
    product_name: string;
    product_slug: string;
    product_price: number;
    product_image: string;
    size: string;
    size_stock: number;
}

export async function getWishlistLowStockNotifications(
    stockThreshold: number = 9
): Promise<WishlistLowStockNotification[]> {
    if (!isSupabaseConfigured) return [];

    try {
        const { data, error } = await supabase
            .rpc('get_wishlist_low_stock_notifications', {
                stock_threshold: stockThreshold
            });

        if (error) {
            console.error('Error getting low stock notifications:', error);
            return [];
        }

        return data || [];
    } catch (e) {
        console.error('Error getting low stock notifications:', e);
        return [];
    }
}

/**
 * Marcar items de wishlist como notificados
 */
export async function markWishlistNotified(wishlistIds: number[]): Promise<boolean> {
    if (!isSupabaseConfigured || wishlistIds.length === 0) return false;

    try {
        const { error } = await supabase
            .rpc('mark_wishlist_notified', {
                wishlist_ids: wishlistIds
            });

        if (error) {
            console.error('Error marking wishlist as notified:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error marking wishlist as notified:', e);
        return false;
    }
}

// =====================================================
// WISHLIST SALE NOTIFICATIONS (Notificaciones de ofertas)
// =====================================================

export interface WishlistSaleNotification {
    wishlist_id: number;
    user_id: string;
    user_email: string;
    user_name: string;
    product_id: number;
    product_name: string;
    product_slug: string;
    original_price: number;
    sale_price: number;
    discount_percentage: number;
    product_image: string;
    size: string;
}

/**
 * Obtener items de wishlist donde el producto está en oferta y no se ha notificado
 */
export async function getWishlistSaleNotifications(): Promise<WishlistSaleNotification[]> {
    if (!isSupabaseConfigured) return [];

    try {
        const { data, error } = await supabase
            .rpc('get_wishlist_sale_notifications');

        if (error) {
            console.error('Error getting sale notifications:', error);
            return [];
        }

        return data || [];
    } catch (e) {
        console.error('Error getting sale notifications:', e);
        return [];
    }
}

/**
 * Marcar items de wishlist como notificados de oferta
 */
export async function markWishlistSaleNotified(wishlistIds: number[]): Promise<boolean> {
    if (!isSupabaseConfigured || wishlistIds.length === 0) return false;

    try {
        const { error } = await supabase
            .rpc('mark_wishlist_sale_notified', {
                wishlist_ids: wishlistIds
            });

        if (error) {
            console.error('Error marking wishlist sale as notified:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error marking wishlist sale as notified:', e);
        return false;
    }
}

/**
 * Resetear notificaciones de oferta para productos que ya no están en oferta
 */
export async function resetWishlistSaleNotifications(): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    try {
        const { error } = await supabase
            .rpc('reset_wishlist_sale_notifications');

        if (error) {
            console.error('Error resetting wishlist sale notifications:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error resetting wishlist sale notifications:', e);
        return false;
    }
}

