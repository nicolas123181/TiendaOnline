import { useStore } from '@nanostores/react';
import { cartCount, openCart, loadCartFromStorage } from '../../stores/cart';
import { useEffect } from 'react';

export default function CartIcon() {
    const count = useStore(cartCount);

    // Cargar carrito desde localStorage al montar
    useEffect(() => {
        loadCartFromStorage();
    }, []);

    return (
        <button
            onClick={openCart}
            className="relative p-2 text-gray-600 hover:text-slate-800 transition-colors group"
            aria-label={`Ver carrito (${count} productos)`}
        >
            {/* Cart Icon */}
            <svg
                className="w-6 h-6 transition-transform group-hover:scale-110"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
            </svg>

            {/* Badge */}
            {count > 0 && (
                <span
                    className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-amber-700 rounded-full animate-scale-in"
                >
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </button>
    );
}
