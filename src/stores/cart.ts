import { atom, map, computed } from 'nanostores';

export interface CartItem {
    id: number;
    name: string;
    slug: string;
    price: number; // En céntimos
    quantity: number;
    size: string;
    image: string;
    maxStock: number;
}

// Estado del carrito usando map para mejor rendimiento
export const cartItems = map<Record<string, CartItem>>({});

// Estado del panel del carrito (abierto/cerrado)
export const isCartOpen = atom<boolean>(false);

// Identificador único para items del carrito (producto + talla)
function getCartItemKey(productId: number, size: string): string {
    return `${productId}-${size}`;
}

// Añadir item al carrito
export function addToCart(item: Omit<CartItem, 'quantity'> & { quantity?: number }) {
    const key = getCartItemKey(item.id, item.size);
    const currentItems = cartItems.get();
    const existingItem = currentItems[key];

    const quantity = item.quantity || 1;

    if (existingItem) {
        // Verificar que no exceda el stock máximo
        const newQuantity = Math.min(
            existingItem.quantity + quantity,
            existingItem.maxStock
        );

        cartItems.setKey(key, {
            ...existingItem,
            quantity: newQuantity
        });
    } else {
        cartItems.setKey(key, {
            ...item,
            quantity: Math.min(quantity, item.maxStock)
        });
    }

    // Abrir el carrito al añadir
    isCartOpen.set(true);

    // Persistir en localStorage
    saveCartToStorage();
}

// Eliminar item del carrito
export function removeFromCart(productId: number, size: string) {
    const key = getCartItemKey(productId, size);
    const currentItems = { ...cartItems.get() };
    delete currentItems[key];
    cartItems.set(currentItems);
    saveCartToStorage();
}

// Actualizar cantidad de un item
export function updateQuantity(productId: number, size: string, quantity: number) {
    const key = getCartItemKey(productId, size);
    const currentItems = cartItems.get();
    const item = currentItems[key];

    if (!item) return;

    if (quantity <= 0) {
        removeFromCart(productId, size);
        return;
    }

    // No exceder stock máximo
    const newQuantity = Math.min(quantity, item.maxStock);

    cartItems.setKey(key, {
        ...item,
        quantity: newQuantity
    });

    saveCartToStorage();
}

// Limpiar carrito completo
export function clearCart() {
    cartItems.set({});
    saveCartToStorage();
}

// Abrir/cerrar panel del carrito
export function toggleCart() {
    isCartOpen.set(!isCartOpen.get());
}

export function openCart() {
    isCartOpen.set(true);
}

export function closeCart() {
    isCartOpen.set(false);
}

// Computed: Array de items
export const cartItemsArray = computed(cartItems, (items) => {
    return Object.values(items);
});

// Computed: Número total de items
export const cartCount = computed(cartItems, (items) => {
    return Object.values(items).reduce((total, item) => total + item.quantity, 0);
});

// Computed: Subtotal en céntimos
export const cartSubtotal = computed(cartItems, (items) => {
    return Object.values(items).reduce(
        (total, item) => total + item.price * item.quantity,
        0
    );
});

// Computed: ¿Está vacío?
export const isCartEmpty = computed(cartItems, (items) => {
    return Object.keys(items).length === 0;
});

// Persistencia en localStorage
const CART_STORAGE_KEY = 'vantage_cart';

export function saveCartToStorage() {
    if (typeof window === 'undefined') return;

    try {
        const items = cartItems.get();
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
        console.error('Error saving cart to storage:', error);
    }
}

export function loadCartFromStorage() {
    if (typeof window === 'undefined') return;

    try {
        const stored = localStorage.getItem(CART_STORAGE_KEY);
        if (stored) {
            const items = JSON.parse(stored);
            cartItems.set(items);
        }
    } catch (error) {
        console.error('Error loading cart from storage:', error);
    }
}

// Inicializar carrito desde localStorage al cargar
if (typeof window !== 'undefined') {
    loadCartFromStorage();
}
