import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface PopupConfig {
    enabled: string;
    title: string;
    subtitle: string;
    description: string;
    promoCode: string;
    delaySeconds: number;
}

export default function NewsletterPopup() {
    const [isOpen, setIsOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState('');
    const [config, setConfig] = useState<PopupConfig>({
        enabled: 'true',
        title: '10% de Descuento Exclusivo',
        subtitle: 'Bienvenido a la excelencia',
        description: 'Suscríbete a nuestra newsletter y recibe un descuento especial en tu primera compra.',
        promoCode: 'BIENVENIDO10',
        delaySeconds: 5,
    });

    useEffect(() => {
        const initPopup = async () => {
            // No mostrar si ya se cerró esta sesión
            const hasSeenPopup = localStorage.getItem('newsletter_popup_seen');
            if (hasSeenPopup) return;

            // Cargar configuración del popup
            let popupConfig = config;
            try {
                const res = await fetch('/api/popup-config');
                if (res.ok) {
                    popupConfig = await res.json();
                    setConfig(popupConfig);
                }
            } catch {
                // usar defaults
            }

            // Si el popup está desactivado en el admin, no mostrar
            if (popupConfig.enabled === 'false') return;

            // Comprobar si el usuario está autenticado Y suscrito
            const supabaseUrl = (import.meta as any).env?.PUBLIC_SUPABASE_URL ||
                (window as any).__SUPABASE_URL__ || 'https://kggjqbhcvvayqwkbpwvp.supabase.co';
            const supabaseAnonKey = (import.meta as any).env?.PUBLIC_SUPABASE_ANON_KEY ||
                (window as any).__SUPABASE_ANON_KEY__;

            if (supabaseUrl && supabaseAnonKey) {
                try {
                    const supabase = createClient(supabaseUrl, supabaseAnonKey);
                    const { data: { session } } = await supabase.auth.getSession();

                    if (session?.user?.email && session.access_token) {
                        // Pre-rellenar el email
                        setEmail(session.user.email);

                        // Verificar suscripción vía API segura (evita problemas de RLS)
                        const statusRes = await fetch('/api/newsletter-status', {
                            headers: { Authorization: `Bearer ${session.access_token}` },
                        });
                        const { subscribed } = statusRes.ok ? await statusRes.json() : { subscribed: false };

                        // Si está suscrito, marcar como visto y no mostrar
                        if (subscribed) {
                            localStorage.setItem('newsletter_popup_seen', 'true');
                            return;
                        }
                    }
                } catch {
                    // Si falla la comprobación, continuar con la lógica normal
                }
            }

            // Mostrar popup tras el delay configurado
            const delay = (popupConfig.delaySeconds ?? 5) * 1000;
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, delay);

            return () => clearTimeout(timer);
        };

        initPopup();
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('newsletter_popup_seen', 'true');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/newsletter-subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const result = await response.json();

            if (result.success) {
                setShowSuccess(true);
                localStorage.setItem('newsletter_popup_seen', 'true');
            } else {
                setError(result.error || 'Error al suscribirse');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
            <div className="bg-white rounded-2xl overflow-hidden max-w-md w-full shadow-2xl animate-scale-in">
                {/* Header - Diseño corporativo premium */}
                <div className="relative bg-brand-navy py-10 px-6">
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
                        aria-label="Cerrar"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="text-center">
                        {/* Logo texto */}
                        <h1 className="text-2xl tracking-[0.3em] font-light text-white mb-3">
                            VANTAGE
                        </h1>
                        <div className="w-12 h-px bg-amber-600 mx-auto mb-4"></div>
                        <p className="text-white/80 text-sm font-light tracking-wide">
                            {config.subtitle}
                        </p>
                    </div>
                </div>

                {/* Contenido */}
                <div className="p-8">
                    {!showSuccess ? (
                        <>
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-serif text-brand-navy mb-2">
                                    {config.title}
                                </h2>
                                <p className="text-gray-600 text-sm">
                                    {config.description}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Tu dirección de email"
                                        required
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-navy/20 focus:border-brand-navy transition-all text-gray-900 placeholder:text-gray-400"
                                    />
                                </div>

                                {error && (
                                    <p className="text-red-600 text-sm text-center">{error}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3.5 bg-brand-navy text-white font-medium rounded-lg hover:bg-brand-navy-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Procesando...
                                        </>
                                    ) : (
                                        'Obtener mi descuento'
                                    )}
                                </button>
                            </form>

                            <button
                                onClick={handleClose}
                                className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                No, gracias
                            </button>
                        </>
                    ) : (
                        <div className="text-center py-2">
                            <div className="w-16 h-16 mx-auto mb-4 bg-brand-navy/10 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-serif text-brand-navy mb-2">
                                Suscripción Confirmada
                            </h3>
                            <p className="text-gray-600 text-sm mb-6">
                                Utiliza este código en tu próxima compra:
                            </p>

                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6">
                                <p className="text-2xl font-mono font-semibold text-brand-navy tracking-widest">
                                    {config.promoCode}
                                </p>
                                <p className="text-sm text-gray-500 mt-2">{config.title}</p>
                            </div>

                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(config.promoCode);
                                    handleClose();
                                }}
                                className="px-8 py-2.5 bg-brand-navy text-white font-medium rounded-lg hover:bg-brand-navy-light transition-colors"
                            >
                                Copiar código y cerrar
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs text-gray-400 text-center">
                        Tu privacidad es importante para nosotros. No compartimos tus datos.
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes scale-in {
                    from {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                .animate-scale-in {
                    animation: scale-in 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}
