import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { verifyAdminRequest, unauthorizedResponse } from '../../../lib/adminAuth';

/**
 * API de Analytics para el Dashboard Ejecutivo
 * GET /api/admin/analytics
 */
export const GET: APIRoute = async ({ request }) => {
    if (!await verifyAdminRequest(request)) {
        return unauthorizedResponse();
    }
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Ventas totales del mes actual
        const { data: salesData } = await supabase
            .from('orders')
            .select('total')
            .in('status', ['paid', 'shipped', 'delivered'])
            .gte('created_at', startOfMonth);

        const monthlySales = salesData?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;

        // 2. Pedidos pendientes de envío
        const { count: pendingOrders } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'paid');

        // 3. Producto más vendido del mes
        const { data: topProductData } = await supabase
            .from('order_items')
            .select(`
                product_id,
                product_name,
                quantity,
                orders!inner(status, created_at)
            `)
            .gte('orders.created_at', startOfMonth)
            .in('orders.status', ['paid', 'shipped', 'delivered']);

        // Agrupar por producto y sumar cantidades
        const productSales: Record<string, { name: string; id: number; sold: number }> = {};
        topProductData?.forEach((item: any) => {
            const key = item.product_id?.toString() || 'unknown';
            if (!productSales[key]) {
                productSales[key] = {
                    id: item.product_id,
                    name: item.product_name,
                    sold: 0
                };
            }
            productSales[key].sold += item.quantity;
        });

        const topProduct = Object.values(productSales)
            .sort((a, b) => b.sold - a.sold)[0] || null;

        // 4. Ventas de los últimos 7 días (para gráfico)
        const { data: dailySalesData } = await supabase
            .from('orders')
            .select('total, created_at')
            .in('status', ['paid', 'shipped', 'delivered'])
            .gte('created_at', sevenDaysAgo)
            .order('created_at', { ascending: true });

        // Agrupar por día
        const salesByDay: Record<string, number> = {};
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        // Inicializar los últimos 7 días con 0
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const key = date.toISOString().split('T')[0];
            salesByDay[key] = 0;
        }

        // Sumar ventas por día
        dailySalesData?.forEach((order: any) => {
            const date = new Date(order.created_at).toISOString().split('T')[0];
            if (salesByDay.hasOwnProperty(date)) {
                salesByDay[date] += order.total || 0;
            }
        });

        // Formatear para Chart.js
        const sortedDates = Object.keys(salesByDay).sort();
        const labels = sortedDates.map(dateStr => {
            const date = new Date(dateStr);
            return dayNames[date.getDay()];
        });
        const data = sortedDates.map(dateStr => salesByDay[dateStr]);

        // 5. Estadísticas adicionales
        const { count: totalOrders } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .in('status', ['paid', 'shipped', 'delivered'])
            .gte('created_at', startOfMonth);

        // 6. Analytics de devoluciones
        const { data: monthlyReturnsData } = await supabase
            .from('returns')
            .select('status, refund_amount')
            .gte('created_at', startOfMonth);

        const { data: weeklyReturnsData } = await supabase
            .from('returns')
            .select('status, refund_amount, refunded_at')
            .gte('created_at', sevenDaysAgo);

        // Devoluciones agrupadas por estado (mes actual)
        const returnsByStatus: Record<string, number> = { pending: 0, in_transit: 0, received: 0, refunded: 0, rejected: 0 };
        monthlyReturnsData?.forEach((r: any) => {
            if (r.status in returnsByStatus) returnsByStatus[r.status]++;
        });

        // Importe total reembolsado este mes
        const monthlyRefunds = monthlyReturnsData
            ?.filter((r: any) => r.status === 'refunded')
            .reduce((sum: number, r: any) => sum + (r.refund_amount || 0), 0) || 0;

        // Reembolsos por día (últimos 7 días) para gráfico de impacto
        const refundsByDay: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const key = date.toISOString().split('T')[0];
            refundsByDay[key] = 0;
        }
        weeklyReturnsData?.forEach((r: any) => {
            if (r.status === 'refunded' && r.refunded_at) {
                const date = new Date(r.refunded_at).toISOString().split('T')[0];
                if (Object.prototype.hasOwnProperty.call(refundsByDay, date)) {
                    refundsByDay[date] += r.refund_amount || 0;
                }
            }
        });
        const refundsChartData = sortedDates.map(d => refundsByDay[d] || 0);

        const response = {
            success: true,
            kpis: {
                monthlySales,
                pendingOrders: pendingOrders || 0,
                topProduct,
                totalOrders: totalOrders || 0,
                monthlyRefunds,
                pendingReturns: returnsByStatus.pending + returnsByStatus.in_transit + returnsByStatus.received
            },
            salesChart: {
                labels,
                data,
                refundsData: refundsChartData
            },
            returnsChart: {
                byStatus: returnsByStatus
            }
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Analytics error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: (error as Error).message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
