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

export default function CheckoutForm({ shippingMethods }: CheckoutFormProps) {
    const items = useStore(cartItemsArray);
    const subtotal = useStore(cartSubtotal);

    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [userEmail, setUserEmail] = useState('');
    const [userName, setUserName] = useState('');

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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Verificar autenticación al cargar
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

                // Pre-llenar formulario con datos del usuario
                setFormData(prev => ({
                    ...prev,
                    customer_email: session.user.email || prev.customer_email,
                    customer_name: session.user.user_metadata?.full_name || prev.customer_name,
                }));
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

    const applyCoupon = async () => {
        if (!couponCode.trim()) return;

        try {
            const response = await fetch('/api/validate-coupon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: couponCode,
                    total: subtotal + shippingCost - couponDiscount
                })
            });

            const data = await response.json();

            if (data.valid) {
                setCouponDiscount(data.discount);
                alert(`¡Cupón aplicado! Descuento: ${formatPrice(data.discount)}`);
            } else {
                alert(data.error || 'Cupón no válido');
            }
        } catch (error) {
            alert('Error al validar el cupón');
            console.error(error);
        }
    };

    const total = subtotal + shippingCost - couponDiscount;

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        // Validaciones
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

        if (items.length === 0) {
            setError('El carrito está vacío');
            return;
        }

        setLoading(true);

        try {
            // 1. Verificar stock (no crea pedido aún)
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

            // 2. Crear Stripe Checkout Session (incluye datos del pedido)
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
                // 3. Redirigir a Stripe Checkout
                window.location.href = checkoutData.url;
            } else {
                throw new Error(checkoutData.error || 'Error al crear sesión de pago');
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            setError(msg);
            console.error('Checkout error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Si aún estamos verificando la autenticación
    if (isLoggedIn === null) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-900 rounded-full animate-spin mx-auto mb-4"></div>
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
                        <svg className="w-10 h-10 text-blue-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                            className="block w-full py-4 bg-blue-900 text-white font-semibold rounded-xl hover:bg-blue-800 transition-colors"
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
        <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
                {/* Logged in user info */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-green-800">
                            Sesión iniciada como {userName || userEmail}
                        </p>
                        <p className="text-xs text-green-600">{userEmail}</p>
                    </div>
                </div>

                {/* Error message */}
                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 text-sm">{error}</p>
                    </div>
                )}

                {/* Información de Envío */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Información de Envío</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nombre Completo *
                            </label>
                            <input
                                type="text"
                                name="customer_name"
                                required
                                value={formData.customer_name}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                placeholder="Juan García"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email *
                            </label>
                            <input
                                type="email"
                                name="customer_email"
                                required
                                value={formData.customer_email}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                placeholder="tu@email.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Teléfono
                            </label>
                            <input
                                type="tel"
                                name="customer_phone"
                                value={formData.customer_phone}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                placeholder="Opcional"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Código Postal *
                            </label>
                            <input
                                type="text"
                                name="customer_postal_code"
                                required
                                value={formData.customer_postal_code}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                placeholder="28001"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Dirección *
                            </label>
                            <input
                                type="text"
                                name="customer_address"
                                required
                                value={formData.customer_address}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                placeholder="Calle Principal 123, Apto 4B"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Ciudad *
                            </label>
                            <input
                                type="text"
                                name="customer_city"
                                required
                                value={formData.customer_city}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                placeholder="Madrid"
                            />
                        </div>
                    </div>
                </div>

                {/* Método de Envío */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Método de Envío</h2>

                    <div className="space-y-3">
                        {shippingMethods.map(method => (
                            <label key={method.id} className="flex items-start p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    name="shipping_method_id"
                                    value={method.id}
                                    checked={formData.shipping_method_id === method.id.toString()}
                                    onChange={handleInputChange}
                                    className="mt-1 w-4 h-4 text-amber-600"
                                />
                                <div className="ml-3 flex-1">
                                    <div className="font-medium text-gray-900">{method.name}</div>
                                    {method.description && (
                                        <div className="text-sm text-gray-600">{method.description}</div>
                                    )}
                                    <div className="text-sm text-gray-500 mt-1">
                                        {method.min_days}-{method.max_days} días • {formatPrice(method.cost)}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Cupón de Descuento */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Código de Descuento</h2>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            placeholder="Ingresa tu código de descuento"
                        />
                        <button
                            type="button"
                            onClick={applyCoupon}
                            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium rounded-lg transition-colors"
                        >
                            Aplicar
                        </button>
                    </div>
                </div>

                {/* Info de Pago */}
                <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                    <div className="flex items-center gap-3 mb-3">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <h3 className="text-lg font-semibold text-blue-900">Pago Seguro con Stripe</h3>
                    </div>
                    <p className="text-blue-700 text-sm">
                        Al hacer clic en "Continuar al Pago", serás redirigido a la pasarela segura de Stripe donde podrás elegir tu método de pago preferido: <strong>Tarjeta de Crédito</strong> o <strong>PayPal</strong>.
                    </p>
                </div>
            </div>

            {/* Sidebar - Resumen del Pedido */}
            <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 sticky top-24">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Resumen del Pedido</h2>

                    {/* Items del carrito */}
                    <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                        {items.map((item, index) => (
                            <div key={index} className="flex gap-3">
                                {item.image && (
                                    <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                    <p className="text-xs text-gray-500">
                                        {item.size && `Talla: ${item.size} • `}
                                        Cant: {item.quantity}
                                    </p>
                                </div>
                                <p className="text-sm font-medium">{formatPrice(item.price * item.quantity)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Totales */}
                    <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Subtotal</span>
                            <span className="font-medium">{formatPrice(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Envío</span>
                            <span className="font-medium">{formatPrice(shippingCost)}</span>
                        </div>
                        {couponDiscount > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Descuento</span>
                                <span className="font-medium">-{formatPrice(couponDiscount)}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between text-lg mb-6">
                        <span className="font-bold text-gray-900">Total</span>
                        <span className="font-bold text-amber-600">{formatPrice(total)}</span>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || items.length === 0}
                        className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 rounded-lg font-bold hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Procesando...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Continuar al Pago
                            </>
                        )}
                    </button>

                    <p className="text-xs text-gray-500 text-center mt-4">
                        Serás redirigido a la pasarela segura de Stripe para completar tu pago.
                    </p>
                </div>
            </div>
        </form>
    );
}
