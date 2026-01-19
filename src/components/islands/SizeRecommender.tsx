import { useState } from 'react';

interface SizeRecommenderProps {
    availableSizes: string[];
    onSizeSelect?: (size: string) => void;
}

/**
 * Algoritmo de recomendación de talla basado en altura y peso
 */
function recommendSize(heightCm: number, weightKg: number): string {
    // Lógica basada en altura + peso para hombre
    if (heightCm < 165) {
        if (weightKg < 60) return 'XS';
        if (weightKg < 70) return 'S';
        if (weightKg < 80) return 'M';
        return 'L';
    } else if (heightCm < 175) {
        if (weightKg < 65) return 'S';
        if (weightKg < 75) return 'M';
        if (weightKg < 85) return 'L';
        return 'XL';
    } else if (heightCm < 185) {
        if (weightKg < 70) return 'M';
        if (weightKg < 80) return 'L';
        if (weightKg < 95) return 'XL';
        return 'XXL';
    } else {
        if (weightKg < 80) return 'L';
        if (weightKg < 95) return 'XL';
        return 'XXL';
    }
}

/**
 * Componente Recomendador de Tallas
 * Abre un modal donde el usuario introduce altura y peso
 */
export default function SizeRecommender({ availableSizes, onSizeSelect }: SizeRecommenderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [recommendation, setRecommendation] = useState<string | null>(null);
    const [error, setError] = useState('');

    const handleCalculate = () => {
        const h = parseInt(height);
        const w = parseInt(weight);

        // Validación
        if (!h || !w) {
            setError('Por favor, introduce tu altura y peso');
            return;
        }

        if (h < 140 || h > 220) {
            setError('La altura debe estar entre 140 y 220 cm');
            return;
        }

        if (w < 40 || w > 150) {
            setError('El peso debe estar entre 40 y 150 kg');
            return;
        }

        setError('');
        const size = recommendSize(h, w);
        setRecommendation(size);
    };

    const handleSelectSize = () => {
        if (recommendation && onSizeSelect) {
            onSizeSelect(recommendation);
            setIsOpen(false);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        setRecommendation(null);
        setError('');
    };

    const isAvailable = recommendation ? availableSizes.includes(recommendation) : false;

    return (
        <>
            {/* Botón para abrir el modal */}
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2 flex items-center gap-1.5 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ¿Cuál es mi talla?
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Overlay */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={handleClose}
                    />

                    {/* Modal content */}
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-semibold">Recomendador de Talla</h3>
                                <button
                                    onClick={handleClose}
                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <p className="text-gray-300 text-sm mt-1">
                                Te ayudamos a encontrar tu talla ideal
                            </p>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            {!recommendation ? (
                                <>
                                    <div className="space-y-4">
                                        {/* Altura */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Altura (cm)
                                            </label>
                                            <input
                                                type="number"
                                                value={height}
                                                onChange={(e) => setHeight(e.target.value)}
                                                placeholder="Ej: 175"
                                                min="140"
                                                max="220"
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-all"
                                            />
                                        </div>

                                        {/* Peso */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Peso (kg)
                                            </label>
                                            <input
                                                type="number"
                                                value={weight}
                                                onChange={(e) => setWeight(e.target.value)}
                                                placeholder="Ej: 75"
                                                min="40"
                                                max="150"
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-all"
                                            />
                                        </div>
                                    </div>

                                    {error && (
                                        <p className="text-red-500 text-sm mt-3">{error}</p>
                                    )}

                                    <button
                                        onClick={handleCalculate}
                                        className="w-full mt-6 bg-gray-900 text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-800 transition-colors"
                                    >
                                        Calcular mi talla
                                    </button>
                                </>
                            ) : (
                                <div className="text-center">
                                    {/* Resultado */}
                                    <div className="mb-6">
                                        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mb-4">
                                            <span className="text-4xl font-bold text-gray-900">{recommendation}</span>
                                        </div>
                                        <h4 className="text-lg font-semibold text-gray-900 mb-1">
                                            ¡Tu talla recomendada es {recommendation}!
                                        </h4>
                                        <p className="text-gray-500 text-sm">
                                            Basado en {height} cm y {weight} kg
                                        </p>
                                    </div>

                                    {/* Estado de disponibilidad */}
                                    {isAvailable ? (
                                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                                            <div className="flex items-center justify-center gap-2 text-green-700">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                <span className="font-medium">¡Esta talla está disponible!</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                                            <div className="flex items-center justify-center gap-2 text-amber-700">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                <span className="font-medium">Esta talla no está disponible actualmente</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setRecommendation(null);
                                                setHeight('');
                                                setWeight('');
                                            }}
                                            className="flex-1 py-3 px-4 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            Recalcular
                                        </button>
                                        {isAvailable && onSizeSelect && (
                                            <button
                                                onClick={handleSelectSize}
                                                className="flex-1 py-3 px-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
                                            >
                                                Seleccionar talla {recommendation}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer con disclaimer */}
                        <div className="px-6 pb-6">
                            <p className="text-xs text-gray-400 text-center">
                                💡 Esta es una recomendación orientativa. Consulta nuestra guía de tallas para medidas exactas.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
