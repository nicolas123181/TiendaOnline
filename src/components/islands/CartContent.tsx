import { useStore } from '@nanostores/react';
import {
    cartItemsArray,
    cartSubtotal,
    updateQuantity,
    removeFromCart,
    isCartEmpty
} from '../../stores/cart';

function formatPrice(cents: number): string {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
    }).format(cents / 100);
}

export default function CartContent() {
    const items = useStore(cartItemsArray);
    const subtotal = useStore(cartSubtotal);
    const isEmpty = useStore(isCartEmpty);

    if (isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-24 h-24 mb-6 text-gray-200">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                        />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Tu carrito está vacío
                </h3>
                <p className="text-gray-500 mb-6">
                    Descubre nuestra colección y encuentra algo que te encante
                </p>
                <a
                    href="/productos"
                    className="px-6 py-3 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-700 transition-colors"
                >
                    Ver productos
                </a>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Items List */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {items.map((item) => (
                    <div
                        key={`${item.id}-${item.size}`}
                        className="flex gap-4 p-4 bg-gray-50 rounded-xl"
                    >
                        {/* Image */}
                        <a href={`/productos/${item.slug}`} className="shrink-0">
                            <img
                                src={item.image}
                                alt={item.name}
                                className="w-20 h-24 object-cover rounded-lg"
                            />
                        </a>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <a
                                        href={`/productos/${item.slug}`}
                                        className="font-medium text-gray-900 hover:text-amber-700 transition-colors line-clamp-1"
                                    >
                                        {item.name}
                                    </a>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        Talla: {item.size}
                                    </p>
                                </div>

                                {/* Remove Button */}
                                <button
                                    onClick={() => removeFromCart(item.id, item.size)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-white"
                                    aria-label={`Eliminar ${item.name}`}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Quantity and Price */}
                            <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors"
                                        aria-label="Reducir cantidad"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                        </svg>
                                    </button>
                                    <span className="w-8 text-center text-sm font-medium">
                                        {item.quantity}
                                    </span>
                                    <button
                                        onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                                        disabled={item.quantity >= item.maxStock}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        aria-label="Aumentar cantidad"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>
                                </div>

                                <span className="font-semibold text-gray-900">
                                    {formatPrice(item.price * item.quantity)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 p-6 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-xl font-semibold text-gray-900">
                        {formatPrice(subtotal)}
                    </span>
                </div>
                <p className="text-sm text-gray-500">
                    Gastos de envío calculados en el checkout
                </p>
            </div>
        </div>
    );
}
