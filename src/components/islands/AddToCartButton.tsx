import { useStore } from '@nanostores/react';
import { addToCart, type CartItem } from '../../stores/cart';
import { useState } from 'react';

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
}

export default function AddToCartButton({ product, sizes = ['S', 'M', 'L', 'XL'] }: AddToCartButtonProps) {
    const [selectedSize, setSelectedSize] = useState<string>('');
    const [quantity, setQuantity] = useState(1);
    const [isAdding, setIsAdding] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState('');

    const isOutOfStock = product.stock <= 0;
    const maxQuantity = Math.min(product.stock, 10);

    const handleAddToCart = () => {
        if (!selectedSize) {
            setError('Por favor, selecciona una talla');
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
                maxStock: product.stock,
            });

            setIsAdding(false);
            setShowSuccess(true);

            // Reset después de 2 segundos
            setTimeout(() => {
                setShowSuccess(false);
            }, 2000);
        }, 300);
    };

    return (
        <div className="space-y-6">
            {/* Size Selector */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-900">Talla</label>
                    <a href="#" className="text-sm text-amber-700 hover:text-amber-800 underline">
                        Guía de tallas
                    </a>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {sizes.map((size) => (
                        <button
                            key={size}
                            onClick={() => {
                                setSelectedSize(size);
                                setError('');
                            }}
                            disabled={isOutOfStock}
                            className={`
                py-3 px-4 text-sm font-medium rounded-xl border-2 transition-all duration-200
                ${selectedSize === size
                                    ? 'border-slate-800 bg-slate-800 text-white'
                                    : 'border-gray-200 text-gray-700 hover:border-gray-400'
                                }
                ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
                        >
                            {size}
                        </button>
                    ))}
                </div>
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
                        disabled={quantity <= 1 || isOutOfStock}
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
                        disabled={quantity >= maxQuantity || isOutOfStock}
                        className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>

                    {product.stock <= 5 && product.stock > 0 && (
                        <span className="text-sm text-amber-600 ml-2">
                            Solo quedan {product.stock}
                        </span>
                    )}
                </div>
            </div>

            {/* Add to Cart Button */}
            <button
                onClick={handleAddToCart}
                disabled={isOutOfStock || isAdding}
                className={`
          w-full py-4 px-6 rounded-xl font-medium text-base transition-all duration-300 flex items-center justify-center gap-3
          ${isOutOfStock
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
                    'Agotado'
                ) : (
                    <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        Añadir al carrito
                    </>
                )}
            </button>

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
