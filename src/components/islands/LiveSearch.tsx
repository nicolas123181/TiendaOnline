import { useState, useEffect, useRef, useCallback } from 'react';

interface SearchResult {
    id: number;
    name: string;
    slug: string;
    image: string;
    price: number;
    salePrice: number | null;
}

/**
 * Componente de Búsqueda Instantánea (Live Search)
 * Con debounce para no saturar la API
 */
export default function LiveSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounce de 300ms
    const debouncedSearch = useCallback((searchQuery: string) => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (searchQuery.length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);

        debounceRef.current = setTimeout(async () => {
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
                const data = await response.json();

                if (data.success) {
                    setResults(data.products);
                    setIsOpen(true);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsLoading(false);
            }
        }, 300);
    }, []);

    // Manejar cambio de input
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        debouncedSearch(value);
    };

    // Cerrar al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setShowSearch(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus en input al abrir
    useEffect(() => {
        if (showSearch && inputRef.current) {
            inputRef.current.focus();
        }
    }, [showSearch]);

    // Formatear precio
    const formatPrice = (cents: number) => {
        return (cents / 100).toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR'
        });
    };

    // Limpiar al desmontar
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    return (
        <div ref={containerRef} className="relative">
            {/* Botón de búsqueda (cerrado) */}
            {!showSearch && (
                <button
                    onClick={() => setShowSearch(true)}
                    className="p-2 text-gray-500 hover:text-gray-900 transition-colors"
                    aria-label="Buscar"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
            )}

            {/* Input de búsqueda (abierto) */}
            {showSearch && (
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={handleInputChange}
                            placeholder="Buscar productos..."
                            className="w-48 sm:w-64 pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-all"
                        />
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>

                        {isLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            setShowSearch(false);
                            setQuery('');
                            setResults([]);
                            setIsOpen(false);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Cerrar búsqueda"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Dropdown de resultados */}
            {isOpen && showSearch && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                    {results.length > 0 ? (
                        <ul className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                            {results.map((product) => (
                                <li key={product.id}>
                                    <a
                                        href={`/productos/${product.slug}`}
                                        className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                                        onClick={() => {
                                            setIsOpen(false);
                                            setShowSearch(false);
                                        }}
                                    >
                                        <img
                                            src={product.image}
                                            alt={product.name}
                                            className="w-12 h-12 object-cover rounded-lg bg-gray-100"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {product.name}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-semibold ${product.salePrice ? 'text-red-600' : 'text-gray-900'}`}>
                                                    {formatPrice(product.salePrice || product.price)}
                                                </span>
                                                {product.salePrice && (
                                                    <span className="text-xs text-gray-400 line-through">
                                                        {formatPrice(product.price)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    ) : query.length >= 2 && !isLoading ? (
                        <div className="p-6 text-center">
                            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-gray-500 text-sm">No se encontraron productos para "{query}"</p>
                            <a href="/productos" className="text-sm text-gray-900 font-medium hover:underline mt-2 inline-block">
                                Ver todos los productos →
                            </a>
                        </div>
                    ) : null}

                    {results.length > 0 && (
                        <div className="p-3 bg-gray-50 border-t border-gray-100">
                            <a
                                href={`/productos?buscar=${encodeURIComponent(query)}`}
                                className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center justify-center gap-1"
                            >
                                Ver todos los resultados
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
