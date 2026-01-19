import React, { useState, useEffect } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { useStore } from '@nanostores/react';
import { cartItemsArray, cartSubtotal, clearCart } from '../../stores/cart';
import type { ShippingMethod } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';

interface CheckoutFormProps {
    shippingMethods: ShippingMethod[];
}

function formatPrice(cents: number): string {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
    }).format(cents / 100);
}

const STEPS = [
    { id: 1, name: 'Información', icon: '📋' },
    { id: 2, name: 'Envío', icon: '🚚' },
    { id: 3, name: 'Descuento', icon: '🎟️' },
    { id: 4, name: 'Confirmación', icon: '✓' },
];

export default function CheckoutForm({ shippingMethods }: CheckoutFormProps) {
    const items = useStore(cartItemsArray);
    const subtotal = useStore(cartSubtotal);

    const [currentStep, setCurrentStep] = useState(1);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [userEmail, setUserEmail] = useState('');
    const [userName, setUserName] = useState('');
    const [savedAddress, setSavedAddress] = useState<any>(null);

    const [formData, setFormData] = useState({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        customer_address: '',
        customer_city: '',
        customer_postal_code: '',
        shipping_method_id: shippingMethods[0]?.id.toString() || '',
    });

    const [shippingCost, setShippingCost] = useState(0);
    const [couponCode, setCouponCode] = useState('');
    const [couponDiscount, setCouponDiscount] = useState(0);
    const [appliedCoupon, setAppliedCoupon] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Verificar autenticación y cargar dirección guardada (sin aplicarla automáticamente)
    useEffect(() => {
        const checkAuth = async () => {
            const supabaseUrl = (import.meta as any).env?.PUBLIC_SUPABASE_URL ||
                (window as any).__SUPABASE_URL__ ||
                'https://kggjqbhcvvayqwkbpwvp.supabase.co';
            const supabaseAnonKey = (import.meta as any).env?.PUBLIC_SUPABASE_ANON_KEY ||
                (window as any).__SUPABASE_ANON_KEY__ ||
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnZ2pxYmhjdnZheXF3a2Jwd3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyNDI2NDQsImV4cCI6MjA1MTgxODY0NH0.P9eqbIFVBt2IuHnzTcCDbGb6w72xR-AQ60aKEkqJnYY';

            const supabase = createClient(supabaseUrl, supabaseAnonKey);
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                setIsLoggedIn(true);
                setUserEmail(session.user.email || '');
                setUserName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '');

                // Solo pre-llenar email
                setFormData(prev => ({
                    ...prev,
                    customer_email: session.user.email || '',
                }));

                // Cargar dirección guardada pero NO aplicarla automáticamente
                try {
                    const { data: address, error } = await supabase
                        .from('user_shipping_addresses')
                        .select('*')
                        .eq('user_id', session.user.id)
                        .eq('is_default', true)
                        .single();

                    if (!error && address) {
                        // Guardar la dirección para usarla cuando el usuario haga click
                        setSavedAddress(address);
                    }
                } catch (err) {
                    console.log('No saved address found');
                }
            } else {
                setIsLoggedIn(false);
            }
        };

        checkAuth();
    }, []);

    const selectedShipping = shippingMethods.find(
        m => m.id.toString() === formData.shipping_method_id
    );

    // Actualizar costo de envío cuando cambia el método
    useEffect(() => {
        if (selectedShipping) {
            setShippingCost(selectedShipping.cost);
        }
    }, [selectedShipping]);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.currentTarget;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Función para cargar dirección guardada
    const loadSavedAddress = () => {
        if (savedAddress) {
            setFormData(prev => ({
                ...prev,
                customer_name: savedAddress.full_name,
                customer_phone: savedAddress.phone,
                customer_address: savedAddress.address,
                customer_city: savedAddress.city,
                customer_postal_code: savedAddress.postal_code,
            }));
        }
    };

    const applyCoupon = async () => {
        if (!couponCode.trim()) return;

        if (!userEmail) {
            setError('Debes iniciar sesión para usar cupones');
            return;
        }

        try {
            const response = await fetch('/api/validate-coupon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: couponCode,
                    total: subtotal + shippingCost - couponDiscount,
                    userEmail: userEmail
                })
            });

            const data = await response.json();

            if (data.valid) {
                setCouponDiscount(data.discount);
                setAppliedCoupon(couponCode);
                setError('');
            } else {
                setCouponDiscount(0);
                setAppliedCoupon('');
                setError(data.message || 'Cupón no válido');
            }
        } catch (error) {
            setError('Error al validar el cupón');
            console.error(error);
        }
    };

    const removeCoupon = () => {
        setCouponCode('');
        setCouponDiscount(0);
        setAppliedCoupon('');
        setError('');
    };

    // Navegación entre pasos
    const goToNextStep = () => {
        setError('');
        
        // Validar paso actual antes de avanzar
        if (currentStep === 1) {
            if (!formData.customer_name.trim()) {
                setError('Por favor ingresa tu nombre');
                return;
            }
            if (!formData.customer_email.trim()) {
                setError('Por favor ingresa tu email');
                return;
            }
            if (!formData.customer_address.trim()) {
                setError('Por favor ingresa tu dirección');
                return;
            }
            if (!formData.customer_city.trim()) {
                setError('Por favor ingresa tu ciudad');
                return;
            }
            if (!formData.customer_postal_code.trim()) {
                setError('Por favor ingresa tu código postal');
                return;
            }
        }

        if (currentStep === 2) {
            if (!formData.shipping_method_id) {
                setError('Por favor selecciona un método de envío');
                return;
            }
        }

        if (currentStep < 4) {
            setCurrentStep(currentStep + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const goToPreviousStep = () => {
        setError('');
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const goToStep = (step: number) => {
        setError('');
        // Solo permitir ir a pasos anteriores o al paso actual
        if (step <= currentStep) {
            setCurrentStep(step);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const total = subtotal + shippingCost - couponDiscount;

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        if (items.length === 0) {
            setError('El carrito está vacío');
            return;
        }

        setLoading(true);

        try {
            // 1. Verificar stock
            const stockResponse = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    customer_name: formData.customer_name,
                    customer_email: formData.customer_email,
                    customer_phone: formData.customer_phone,
                    customer_address: formData.customer_address,
                    customer_city: formData.customer_city,
                    customer_postal_code: formData.customer_postal_code,
                    shipping_method_id: formData.shipping_method_id,
                    cart_items: JSON.stringify(items),
                    total: total.toString(),
                    subtotal: subtotal.toString(),
                    shipping: shippingCost.toString(),
                    discount: couponDiscount.toString(),
                }),
            });

            const stockData = await stockResponse.json();

            if (!stockData.success) {
                throw new Error(stockData.error || 'Error al verificar stock');
            }

            // 2. Crear Stripe Checkout Session
            const checkoutResponse = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map(item => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        image: item.image,
                        size: item.size,
                    })),
                    customer_email: formData.customer_email,
                    customer_name: formData.customer_name,
                    customer_address: formData.customer_address,
                    customer_city: formData.customer_city,
                    customer_postal_code: formData.customer_postal_code,
                    customer_phone: formData.customer_phone,
                    shipping_method_id: formData.shipping_method_id,
                    shipping_cost: shippingCost,
                    subtotal: subtotal,
                    discount: couponDiscount,
                    total: total,
                }),
            });

            const checkoutData = await checkoutResponse.json();

            if (checkoutData.url) {
                window.location.href = checkoutData.url;
            } else {
                throw new Error(checkoutData.error || 'Error al crear sesión de pago');
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            setError(msg);
            console.error('Checkout error:', err);
            setCurrentStep(4); // Volver al resumen si hay error
        } finally {
            setLoading(false);
        }
    };

    // Si aún estamos verificando la autenticación
    if (isLoggedIn === null) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-gray-200 border-t-brand-navy rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Verificando sesión...</p>
                </div>
            </div>
        );
    }

    // Si no está logueado, mostrar mensaje
    if (isLoggedIn === false) {
        return (
            <div className="max-w-md mx-auto py-12">
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center border border-gray-100">
                    <div className="w-20 h-20 mx-auto mb-6 bg-blue-50 rounded-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">
                        Inicia sesión para continuar
                    </h2>
                    <p className="text-gray-600 mb-8">
                        Necesitas una cuenta para realizar tu compra y poder hacer seguimiento de tus pedidos.
                    </p>
                    <div className="space-y-3">
                        <a
                            href={`/login?returnTo=${encodeURIComponent('/checkout')}`}
                            className="block w-full py-4 bg-brand-navy text-white font-semibold rounded-xl hover:bg-brand-navy-light transition-colors"
                        >
                            Iniciar Sesión
                        </a>
                        <a
                            href={`/registro?returnTo=${encodeURIComponent('/checkout')}`}
                            className="block w-full py-4 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Crear Cuenta
                        </a>
                    </div>
                    <p className="text-sm text-gray-500 mt-6">
                        Tu carrito se mantendrá guardado
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Stepper Header - Indicador de Progreso */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
                <div className="flex items-center justify-between">
                    {STEPS.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <button
                                type="button"
                                onClick={() => goToStep(step.id)}
                                disabled={step.id > currentStep}
                                className={`flex flex-col items-center gap-2 transition-all ${
                                    step.id <= currentStep ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                                }`}
                            >
                                <div
                                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                                        step.id === currentStep
                                            ? 'bg-brand-navy text-white scale-110 shadow-lg'
                                            : step.id < currentStep
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-200 text-gray-400'
                                    }`}
                                >
                                    {step.id < currentStep ? '✓' : step.icon}
                                </div>
                                <span
                                    className={`text-sm font-medium hidden md:block ${
                                        step.id === currentStep
                                            ? 'text-brand-navy'
                                            : step.id < currentStep
                                            ? 'text-green-600'
                                            : 'text-gray-400'
                                    }`}
                                >
                                    {step.name}
                                </span>
                            </button>
                            {index < STEPS.length - 1 && (
                                <div className="flex-1 h-1 mx-4">
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ${
                                            step.id < currentStep ? 'bg-green-500' : 'bg-gray-200'
                                        }`}
                                    ></div>
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2">
                    {/* User Info Banner */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-green-800 truncate">
                                {userName || userEmail}
                            </p>
                            <p className="text-xs text-green-600 truncate">{userEmail}</p>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <p className="text-red-700 text-sm flex-1">{error}</p>
                        </div>
                    )}

                    {/* Step Content */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* PASO 1: Información de Envío */}
                        {currentStep === 1 && (
                            <div className="p-8 animate-fade-in">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">Información de Envío</h2>
                                        <p className="text-gray-500 text-sm mt-1">Completa tus datos de entrega</p>
                                    </div>
                                    {savedAddress && (
                                        <button
                                            type="button"
                                            onClick={loadSavedAddress}
                                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-brand-navy bg-blue-50 rounded-xl hover:bg-blue-100 transition-all hover:scale-105"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            Usar dirección guardada
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Nombre Completo <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="customer_name"
                                            required
                                            value={formData.customer_name}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-navy focus:border-brand-navy transition-all"
                                            placeholder="Juan García Martínez"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Email <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            name="customer_email"
                                            required
                                            value={formData.customer_email}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-navy focus:border-brand-navy transition-all"
                                            placeholder="tu@email.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Teléfono
                                        </label>
                                        <input
                                            type="tel"
                                            name="customer_phone"
                                            value={formData.customer_phone}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-navy focus:border-brand-navy transition-all"
                                            placeholder="+34 600 123 456"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Código Postal <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="customer_postal_code"
                                            required
                                            value={formData.customer_postal_code}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-navy focus:border-brand-navy transition-all"
                                            placeholder="28001"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Dirección Completa <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="customer_address"
                                            required
                                            value={formData.customer_address}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-navy focus:border-brand-navy transition-all"
                                            placeholder="Calle Principal 123, Piso 4, Puerta B"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Ciudad <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="customer_city"
                                            required
                                            value={formData.customer_city}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-navy focus:border-brand-navy transition-all"
                                            placeholder="Madrid"
                                        />
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={goToNextStep}
                                        className="px-8 py-3.5 bg-brand-navy text-white font-semibold rounded-xl hover:bg-brand-navy-light transition-all hover:scale-105 flex items-center gap-2 shadow-lg"
                                    >
                                        Continuar
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PASO 2: Método de Envío */}
                        {currentStep === 2 && (
                            <div className="p-8 animate-fade-in">
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">Método de Envío</h2>
                                    <p className="text-gray-500 text-sm mt-1">Selecciona cómo deseas recibir tu pedido</p>
                                </div>

                                <div className="space-y-4">
                                    {shippingMethods.map(method => (
                                        <label
                                            key={method.id}
                                            className={`flex items-start p-5 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                                                formData.shipping_method_id === method.id.toString()
                                                    ? 'border-brand-navy bg-blue-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="shipping_method_id"
                                                value={method.id}
                                                checked={formData.shipping_method_id === method.id.toString()}
                                                onChange={handleInputChange}
                                                className="mt-1 w-5 h-5 text-brand-navy focus:ring-brand-navy"
                                            />
                                            <div className="ml-4 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <div className="font-bold text-gray-900">{method.name}</div>
                                                    <div className="text-lg font-bold text-brand-navy">{formatPrice(method.cost)}</div>
                                                </div>
                                                {method.description && (
                                                    <div className="text-sm text-gray-600 mt-1">{method.description}</div>
                                                )}
                                                <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {method.min_days}-{method.max_days} días laborables
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                <div className="mt-8 flex justify-between">
                                    <button
                                        type="button"
                                        onClick={goToPreviousStep}
                                        className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                                        </svg>
                                        Atrás
                                    </button>
                                    <button
                                        type="button"
                                        onClick={goToNextStep}
                                        className="px-8 py-3.5 bg-brand-navy text-white font-semibold rounded-xl hover:bg-brand-navy-light transition-all hover:scale-105 flex items-center gap-2 shadow-lg"
                                    >
                                        Continuar
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PASO 3: Código de Descuento (Opcional) */}
                        {currentStep === 3 && (
                            <div className="p-8 animate-fade-in">
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">Código de Descuento</h2>
                                    <p className="text-gray-500 text-sm mt-1">¿Tienes un cupón? ¡Aplícalo aquí! (Opcional)</p>
                                </div>

                                {appliedCoupon ? (
                                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 mb-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                                                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-green-800">¡Cupón aplicado!</p>
                                                    <p className="text-sm text-green-600">Código: {appliedCoupon}</p>
                                                    <p className="text-lg font-bold text-green-700 mt-1">-{formatPrice(couponDiscount)}</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={removeCoupon}
                                                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 mb-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="text-3xl">🎟️</div>
                                            <div>
                                                <p className="font-semibold text-gray-900">Ingresa tu código</p>
                                                <p className="text-sm text-gray-600">Ahorra en tu compra con cupones especiales</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                value={couponCode}
                                                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-navy focus:border-brand-navy transition-all uppercase"
                                                placeholder="Ej: DESCUENTO10"
                                            />
                                            <button
                                                type="button"
                                                onClick={applyCoupon}
                                                disabled={!couponCode.trim()}
                                                className="px-6 py-3 bg-brand-navy text-white font-semibold rounded-xl hover:bg-brand-navy-light transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Aplicar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                                    <div className="flex gap-3">
                                        <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                        <div>
                                            <p className="text-sm font-semibold text-blue-900">Este paso es opcional</p>
                                            <p className="text-sm text-blue-700 mt-1">
                                                Si no tienes un código de descuento, puedes continuar directamente al siguiente paso
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-between">
                                    <button
                                        type="button"
                                        onClick={goToPreviousStep}
                                        className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                                        </svg>
                                        Atrás
                                    </button>
                                    <button
                                        type="button"
                                        onClick={goToNextStep}
                                        className="px-8 py-3.5 bg-brand-navy text-white font-semibold rounded-xl hover:bg-brand-navy-light transition-all hover:scale-105 flex items-center gap-2 shadow-lg"
                                    >
                                        Continuar
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PASO 4: Resumen y Confirmación */}
                        {currentStep === 4 && (
                            <div className="p-8 animate-fade-in">
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">Resumen del Pedido</h2>
                                    <p className="text-gray-500 text-sm mt-1">Revisa tu información antes de proceder al pago</p>
                                </div>

                                {/* Resumen de Datos */}
                                <div className="space-y-4">
                                    {/* Información de Envío */}
                                    <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                <span className="text-xl">📋</span>
                                                Información de Envío
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentStep(1)}
                                                className="text-sm text-brand-navy hover:underline font-medium"
                                            >
                                                Editar
                                            </button>
                                        </div>
                                        <div className="text-sm text-gray-700 space-y-1">
                                            <p className="font-semibold">{formData.customer_name}</p>
                                            <p>{formData.customer_email}</p>
                                            {formData.customer_phone && <p>{formData.customer_phone}</p>}
                                            <p className="pt-2">{formData.customer_address}</p>
                                            <p>{formData.customer_postal_code} {formData.customer_city}</p>
                                        </div>
                                    </div>

                                    {/* Método de Envío */}
                                    <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                <span className="text-xl">🚚</span>
                                                Método de Envío
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentStep(2)}
                                                className="text-sm text-brand-navy hover:underline font-medium"
                                            >
                                                Editar
                                            </button>
                                        </div>
                                        {selectedShipping && (
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm text-gray-700">
                                                    <p className="font-semibold">{selectedShipping.name}</p>
                                                    <p className="text-gray-500">{selectedShipping.min_days}-{selectedShipping.max_days} días laborables</p>
                                                </div>
                                                <p className="font-bold text-brand-navy">{formatPrice(selectedShipping.cost)}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Cupón */}
                                    {appliedCoupon && (
                                        <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-bold text-green-900 flex items-center gap-2">
                                                    <span className="text-xl">🎟️</span>
                                                    Código de Descuento
                                                </h3>
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentStep(3)}
                                                    className="text-sm text-brand-navy hover:underline font-medium"
                                                >
                                                    Editar
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-green-700">Cupón: <span className="font-bold">{appliedCoupon}</span></p>
                                                <p className="font-bold text-green-600">-{formatPrice(couponDiscount)}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Info de Pago Seguro */}
                                <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shrink-0">
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-blue-900 mb-2">Pago 100% Seguro</h3>
                                            <p className="text-blue-700 text-sm leading-relaxed">
                                                Al continuar serás redirigido a <strong>Stripe</strong>, nuestra pasarela de pago segura donde podrás elegir:
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <span className="px-3 py-1.5 bg-white rounded-lg text-xs font-semibold text-blue-900 border border-blue-200">💳 Tarjeta de Crédito</span>
                                                <span className="px-3 py-1.5 bg-white rounded-lg text-xs font-semibold text-blue-900 border border-blue-200">💳 Tarjeta de Débito</span>
                                                <span className="px-3 py-1.5 bg-white rounded-lg text-xs font-semibold text-blue-900 border border-blue-200">🅿️ PayPal</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-between">
                                    <button
                                        type="button"
                                        onClick={goToPreviousStep}
                                        className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                                        </svg>
                                        Atrás
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || items.length === 0}
                                        className="px-8 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 flex items-center gap-2 shadow-xl"
                                    >
                                        {loading ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Procesando...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                                Proceder al Pago Seguro
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar - Resumen del Pedido */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">Tu Pedido</h3>

                        {/* Items */}
                        <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
                            {items.map((item, index) => (
                                <div key={index} className="flex gap-3">
                                    {item.image && (
                                        <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {item.size && `Talla: ${item.size} • `}
                                            Cant: {item.quantity}
                                        </p>
                                        <p className="text-sm font-bold text-brand-navy mt-1">{formatPrice(item.price * item.quantity)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Totales */}
                        <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-semibold">{formatPrice(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Envío</span>
                                <span className="font-semibold">{formatPrice(shippingCost)}</span>
                            </div>
                            {couponDiscount > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-green-600 font-medium">Descuento</span>
                                    <span className="font-semibold text-green-600">-{formatPrice(couponDiscount)}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center mb-6">
                            <span className="text-lg font-bold text-gray-900">Total</span>
                            <span className="text-2xl font-bold text-brand-navy">{formatPrice(total)}</span>
                        </div>

                        {/* Progress Indicator */}
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {currentStep}
                                </div>
                                <span className="text-sm font-semibold text-blue-900">
                                    Paso {currentStep} de 4
                                </span>
                            </div>
                            <p className="text-xs text-blue-700">
                                {currentStep === 1 && 'Completa tu información de envío'}
                                {currentStep === 2 && 'Elige tu método de envío preferido'}
                                {currentStep === 3 && 'Aplica un código de descuento (opcional)'}
                                {currentStep === 4 && 'Revisa y confirma tu pedido'}
                            </p>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
