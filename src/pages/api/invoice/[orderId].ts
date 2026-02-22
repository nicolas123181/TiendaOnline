import type { APIRoute } from "astro";
import { getServiceSupabase, supabase } from "../../../lib/supabase";

export const GET: APIRoute = async ({ params, redirect }) => {
  const orderIdParam = params.orderId;
  if (!orderIdParam) {
    return new Response(JSON.stringify({ error: "Order ID is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const orderId = parseInt(orderIdParam, 10);
  if (isNaN(orderId)) {
    return new Response(JSON.stringify({ error: "Invalid Order ID format" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  try {
    let db;
    try {
      db = getServiceSupabase();
    } catch {
      db = supabase;
    }

    // Obtener la factura original (primera por created_at) para redirect al PDF
    const { data: invoices, error: invoiceError } = await db
      .from("invoices")
      .select("id")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .limit(1);

    const invoice = invoices?.[0];
    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    // Redirigir al endpoint de PDF real
    return redirect(`/api/invoice/${invoice.id}/pdf`, 302);
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
