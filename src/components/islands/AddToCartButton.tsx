import { useStore } from '@nanostores/react';
import { addToCart, type CartItem } from '../../stores/cart';
import { useState, useMemo } from 'react';
import SizeRecommender from './SizeRecommender';

interface SizeStock {
    size: string;
    stock: number;
}

interface AddToCartButtonProps {
    product: {
        id: number;
        name: string;
        slug: string;
        price: number;
        stock: number;
        images: string[];
        categorySlug?: string;
    };
    sizes?: string[];
    sizeStocks?: SizeStock[]; // Stock por talla
}

export default function AddToCartButton({
    product,
    sizes = ['S', 'M', 'L', 'XL'],
    sizeStocks = []
}: AddToCartButtonProps) {
    const [selectedSize, setSelectedSize] = useState<string>('');
    const [quantity, setQuantity] = useState(1);
    const [isAdding, setIsAdding] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState('');

    // Wishlist state
    const [isInWishlist, setIsInWishlist] = useState(false);
    const [isWishlistLoading, setIsWishlistLoading] = useState(false);
    const [showWishlistToast, setShowWishlistToast] = useState(false);
    const [wishlistToastMessage, setWishlistToastMessage] = useState('');
    const [wishlistRequiresLogin, setWishlistRequiresLogin] = useState(false);

    // Crear mapa de stock por talla
    const sizeStockMap = useMemo(() => {
        const map: Record<string, number> = {};
        sizeStocks.forEach(s => {
            map[s.size] = s.stock;
        });
        return map;
    }, [sizeStocks]);

    // Stock de la talla seleccionada
    const selectedSizeStock = useMemo(() => {
        if (!selectedSize) return 0;
        return sizeStockMap[selectedSize] ?? 0;
    }, [selectedSize, sizeStockMap]);

    // Verificar si hay stock por tallas disponible
    const hasAnyStock = useMemo(() => {
        if (sizeStocks.length > 0) {
            return sizeStocks.some(s => s.stock > 0);
        }
        return product.stock > 0;
    }, [sizeStocks, product.stock]);

    const isOutOfStock = !hasAnyStock;
    const isSizeOutOfStock = selectedSize !== '' && selectedSizeStock <= 0;
    const maxQuantity = Math.min(selectedSizeStock || product.stock, 10);

    // Check wishlist status when size changes
    const checkWishlistStatus = async () => {
        if (!selectedSize) {
            setIsInWishlist(false);
            return;
        }

        try {
            const res = await fetch(`/api/wishlist?productId=${product.id}&size=${encodeURIComponent(selectedSize)}`);
            const data = await res.json();

            if (res.ok) {
                setIsInWishlist(data.isInWishlist);
            }
        } catch (e) {
            console.error('Error checking wishlist status:', e);
        }
    };

    // Check wishlist status when size is selected
    useMemo(() => {
        if (selectedSize) {
            checkWishlistStatus();
        }
    }, [selectedSize, product.id]);

    const handleToggleWishlist = async () => {
        if (!selectedSize) {
            setWishlistToastMessage('Selecciona una talla primero');
            setShowWishlistToast(true);
            setTimeout(() => setShowWishlistToast(false), 2500);
            return;
        }

        setIsWishlistLoading(true);
        setWishlistRequiresLogin(false);

        try {
            if (isInWishlist) {
                // Remove from wishlist
                const res = await fetch(`/api/wishlist?productId=${product.id}&size=${encodeURIComponent(selectedSize)}`, {
                    method: 'DELETE',
                });
                const data = await res.json();

                if (res.ok) {
                    setIsInWishlist(false);
                    setWishlistToastMessage('Eliminado de favoritos');
                } else if (res.status === 401) {
                    setWishlistRequiresLogin(true);
                    setWishlistToastMessage('Inicia sesión para guardar favoritos');
                } else {
                    setWishlistToastMessage('Error al eliminar');
                }
            } else {
                // Add to wishlist
                const res = await fetch('/api/wishlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: product.id, size: selectedSize }),
                });
                const data = await res.json();

                if (res.ok) {
                    setIsInWishlist(true);
                    setWishlistToastMessage('¡Añadido a favoritos!');
                } else if (res.status === 401) {
                    setWishlistRequiresLogin(true);
                    setWishlistToastMessage('Inicia sesión para guardar favoritos');
                } else {
                    setWishlistToastMessage('Error al añadir');
                }
            }
        } catch (e) {
            console.error('Error toggling wishlist:', e);
            setWishlistToastMessage('Error de conexión');
        } finally {
            setIsWishlistLoading(false);
            setShowWishlistToast(true);
            setTimeout(() => setShowWishlistToast(false), 2500);
        }
    };

    const handleAddToCart = () => {
        if (!selectedSize) {
            setError('Por favor, selecciona una talla');
            return;
        }

        if (isSizeOutOfStock) {
            setError('Esta talla está agotada');
            return;
        }

        if (isOutOfStock) return;

        setError('');
        setIsAdding(true);

        // Simular pequeño delay para feedback visual
        setTimeout(() => {
            addToCart({
                id: product.id,
                name: product.name,
                slug: product.slug,
                price: product.price,
                quantity,
                size: selectedSize,
                image: product.images?.[0] || '/placeholder-product.jpg',
                maxStock: selectedSizeStock || product.stock,
            });

            setIsAdding(false);
            setShowSuccess(true);

            // Reset después de 2 segundos
            setTimeout(() => {
                setShowSuccess(false);
            }, 2000);
        }, 300);
    };


    // Obtener stock para mostrar de una talla
    const getStockForSize = (size: string): number => {
        if (sizeStocks.length > 0) {
            return sizeStockMap[size] ?? 0;
        }
        return product.stock;
    };

    // Verificar si una talla está agotada
    const isSizeEmpty = (size: string): boolean => {
        return getStockForSize(size) <= 0;
    };

    return (
        <div className="space-y-6">
            {/* Size Selector */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-900">Talla</label>
                    <div className="flex items-center gap-3">
                        <SizeRecommender
                            availableSizes={sizes.filter(s => !isSizeEmpty(s))}
                            onSizeSelect={(size) => {
                                setSelectedSize(size);
                                setError('');
                                setQuantity(1);
                            }}
                        />
                        <span className="text-gray-300">|</span>
                        <a href="/guia-tallas" target="_blank" className="text-sm text-amber-700 hover:text-amber-800 underline">
                            Guía de tallas
                        </a>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {sizes.map((size) => {
                        const sizeEmpty = isSizeEmpty(size);
                        const sizeStock = getStockForSize(size);
                        return (
                            <button
                                key={size}
                                onClick={() => {
                                    if (!sizeEmpty) {
                                        setSelectedSize(size);
                                        setError('');
                                        setQuantity(1); // Reset quantity when size changes
                                    }
                                }}
                                disabled={sizeEmpty}
                                className={`
                                    relative py-3 px-4 text-sm font-medium rounded-xl border-2 transition-all duration-200
                                    ${selectedSize === size
                                        ? 'border-slate-800 bg-slate-800 text-white'
                                        : sizeEmpty
                                            ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                                            : 'border-gray-200 text-gray-700 hover:border-gray-400'
                                    }
                                `}
                                title={sizeEmpty ? 'Agotado' : `${sizeStock} disponibles`}
                            >
                                {size}
                                {sizeEmpty && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Low stock warning - shows when less than 9 units */}
                {selectedSize && !isSizeOutOfStock && selectedSizeStock > 0 && selectedSizeStock < 9 && (
                    <div className="mt-3 px-3 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                        <p className="text-sm font-medium text-amber-700 flex items-center gap-2">
                            <svg className="w-4 h-4 text-amber-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            ¡Pocas unidades disponibles!
                        </p>
                    </div>
                )}

                {error && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {error}
                    </p>
                )}
            </div>

            {/* Quantity Selector */}
            <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">Cantidad</label>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1 || isOutOfStock || isSizeOutOfStock}
                        className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                    </button>
                    <span className="w-16 text-center text-lg font-medium text-gray-900">
                        {quantity}
                    </span>
                    <button
                        onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                        disabled={quantity >= maxQuantity || isOutOfStock || isSizeOutOfStock}
                        className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Actions Row: Wishlist + Add to Cart */}
            <div className="flex gap-3">
                {/* Wishlist Button */}
                <button
                    onClick={handleToggleWishlist}
                    disabled={isWishlistLoading || !selectedSize}
                    title={isInWishlist ? 'Quitar de favoritos' : selectedSize ? 'Añadir a favoritos' : 'Selecciona una talla primero'}
                    className={`
                        flex-shrink-0 w-14 h-14 rounded-xl border-2 flex items-center justify-center transition-all duration-300
                        ${!selectedSize
                            ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                            : isInWishlist
                                ? 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100'
                                : 'border-gray-200 bg-white text-gray-400 hover:border-red-200 hover:text-red-400 hover:bg-red-50'
                        }
                        ${isWishlistLoading ? 'opacity-50' : ''}
                    `}
                >
                    {isWishlistLoading ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    ) : (
                        <svg
                            className={`w-6 h-6 transition-transform ${isInWishlist ? 'scale-110' : ''}`}
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
                </button>

                {/* Add to Cart Button */}
                <button
                    onClick={handleAddToCart}
                    disabled={isOutOfStock || isSizeOutOfStock || isAdding || !selectedSize}
                    className={`
                        flex-1 py-4 px-6 rounded-xl font-medium text-base transition-all duration-300 flex items-center justify-center gap-3
                        ${isOutOfStock || isSizeOutOfStock
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : showSuccess
                                ? 'bg-green-600 text-white scale-[1.02]'
                                : 'bg-slate-800 text-white hover:bg-slate-700 active:scale-[0.98]'
                        }
                    `}
                >
                    {isAdding ? (
                        <>
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Añadiendo...
                        </>
                    ) : showSuccess ? (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            ¡Añadido al carrito!
                        </>
                    ) : isOutOfStock ? (
                        'Producto Agotado'
                    ) : isSizeOutOfStock ? (
                        'Talla Agotada'
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                            Añadir al carrito
                        </>
                    )}
                </button>
            </div>

            {/* Wishlist Toast */}
            {showWishlistToast && (
                <div
                    className={`
                        fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                        px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2
                        animate-slide-up
                        ${wishlistRequiresLogin
                            ? 'bg-amber-500 text-white'
                            : isInWishlist
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-800 text-white'
                        }
                    `}
                >
                    {isInWishlist ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    )}
                    {wishlistToastMessage}
                    {wishlistRequiresLogin && (
                        <a href={`/login?redirect=${encodeURIComponent(window.location.pathname)}`} className="underline ml-1">
                            Iniciar sesión
                        </a>
                    )}
                </div>
            )}

            <style>{`
                @keyframes slide-up {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>

            {/* Additional Info */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Devolución 30 días
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    Envío gratis +50€
                </div>
            </div>
        </div>
    );
}
