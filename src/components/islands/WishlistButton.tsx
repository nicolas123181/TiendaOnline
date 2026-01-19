import { useState, useEffect } from 'react';

interface WishlistButtonProps {
    productId: number;
    productName: string;
    selectedSize: string;
    className?: string;
    showText?: boolean;
}

export default function WishlistButton({
    productId,
    productName,
    selectedSize,
    className = '',
    showText = true
}: WishlistButtonProps) {
    const [isInWishlist, setIsInWishlist] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [requiresLogin, setRequiresLogin] = useState(false);

    // Verificar si está en wishlist al montar o cuando cambia la talla
    useEffect(() => {
        if (!selectedSize) {
            setIsInWishlist(false);
            return;
        }

        checkWishlistStatus();
    }, [productId, selectedSize]);

    const checkWishlistStatus = async () => {
        if (!selectedSize) return;

        try {
            const res = await fetch(`/api/wishlist?productId=${productId}&size=${encodeURIComponent(selectedSize)}`);
            const data = await res.json();

            if (res.ok) {
                setIsInWishlist(data.isInWishlist);
            }
        } catch (e) {
            console.error('Error checking wishlist status:', e);
        }
    };

    const handleToggleWishlist = async () => {
        if (!selectedSize) {
            setToastMessage('Selecciona una talla primero');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2500);
            return;
        }

        setIsLoading(true);

        try {
            if (isInWishlist) {
                // Quitar de wishlist
                const res = await fetch(`/api/wishlist?productId=${productId}&size=${encodeURIComponent(selectedSize)}`, {
                    method: 'DELETE',
                });
                const data = await res.json();

                if (res.ok) {
                    setIsInWishlist(false);
                    setToastMessage('Eliminado de favoritos');
                } else if (res.status === 401) {
                    setRequiresLogin(true);
                    setToastMessage('Inicia sesión para guardar favoritos');
                } else {
                    setToastMessage('Error al eliminar');
                }
            } else {
                // Añadir a wishlist
                const res = await fetch('/api/wishlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId, size: selectedSize }),
                });
                const data = await res.json();

                if (res.ok) {
                    setIsInWishlist(true);
                    setToastMessage('Añadido a favoritos');
                } else if (res.status === 401) {
                    setRequiresLogin(true);
                    setToastMessage('Inicia sesión para guardar favoritos');
                } else {
                    setToastMessage('Error al añadir');
                }
            }
        } catch (e) {
            console.error('Error toggling wishlist:', e);
            setToastMessage('Error de conexión');
        } finally {
            setIsLoading(false);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2500);
        }
    };

    // Si requiere login, redirigir
    const handleLoginRedirect = () => {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    };

    return (
        <div className="relative">
            <button
                onClick={requiresLogin ? handleLoginRedirect : handleToggleWishlist}
                disabled={isLoading}
                title={isInWishlist ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                className={`
                    flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-300
                    ${isInWishlist
                        ? 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-red-400'
                    }
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${className}
                `}
            >
                {isLoading ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                ) : (
                    <svg
                        className={`w-5 h-5 transition-transform ${isInWishlist ? 'scale-110' : ''}`}
                        fill={isInWishlist ? 'currentColor' : 'none'}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                    </svg>
                )}
                {showText && (
                    <span className="text-sm font-medium">
                        {isInWishlist ? 'En favoritos' : 'Favorito'}
                    </span>
                )}
            </button>

            {/* Toast notification */}
            {showToast && (
                <div
                    className={`
                        absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap
                        px-4 py-2 rounded-lg shadow-lg text-sm font-medium
                        animate-fade-in-up z-50
                        ${requiresLogin
                            ? 'bg-amber-500 text-white'
                            : isInWishlist
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-800 text-white'
                        }
                    `}
                >
                    {toastMessage}
                    {requiresLogin && (
                        <span className="ml-2 underline cursor-pointer" onClick={handleLoginRedirect}>
                            Iniciar sesión
                        </span>
                    )}
                </div>
            )}

            <style>{`
                @keyframes fade-in-up {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}
