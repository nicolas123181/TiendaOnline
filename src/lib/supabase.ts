import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

// Cliente con service role para operaciones admin (solo server-side)
export function getServiceSupabase(): SupabaseClient {
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
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

export async function validateCoupon(code: string, orderTotal: number): Promise<{ valid: boolean; discount: number; message: string }> {
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
            return { valid: false, discount: 0, message: 'Cupón no encontrado' };
        }

        const now = new Date().toISOString();

        // Validar fechas
        if (new Date(data.start_date) > new Date(now)) {
            return { valid: false, discount: 0, message: 'Este cupón no está disponible aún' };
        }

        if (data.end_date && new Date(data.end_date) < new Date(now)) {
            return { valid: false, discount: 0, message: 'Este cupón ha expirado' };
        }

        // Validar límite de usos
        if (data.max_uses && data.used_count >= data.max_uses) {
            return { valid: false, discount: 0, message: 'Este cupón ya no está disponible' };
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

        return { valid: true, discount, message: 'Cupón aplicado correctamente' };
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
