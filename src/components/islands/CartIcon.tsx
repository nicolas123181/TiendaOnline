import { useStore } from '@nanostores/react';
import { cartCount, openCart, loadCartFromStorage } from '../../stores/cart';
import { useEffect, useState } from 'react';

export default function CartIcon() {
    const count = useStore(cartCount);
    const [mounted, setMounted] = useState(false); // Init false to match server

    // Cargar carrito desde localStorage al montar
    useEffect(() => {
        setMounted(true);
        loadCartFromStorage();
    }, []);

    // Prevent hydration mismatch by consistently rendering '0' or nothing on server match
    // Only show badge if mounted
    if (!mounted) {
        return (
            <button
                onClick={openCart}
                className="relative p-2 text-gray-600 hover:text-slate-800 transition-colors group"
                aria-label="Ver carrito"
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
            </button>
        );
    }

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
