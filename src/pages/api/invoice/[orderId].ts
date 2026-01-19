import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { generateInvoiceHTML } from "../../../lib/invoice";

export const GET: APIRoute = async ({ params }) => {
  const orderIdParam = params.orderId;
  if (!orderIdParam) {
    return new Response(JSON.stringify({ error: "Order ID is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const orderId = parseInt(orderIdParam, 10);
  if (isNaN(orderId)) {
    return new Response(JSON.stringify({ error: "Invalid Order ID format" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  try {
    console.log("Loading invoice for order ID:", orderId);
    const { data: invoice, error: invoiceError } = await supabase.from("invoices").select("*").eq("order_id", orderId).single();
    if (invoiceError || !invoice) {
      console.error("Invoice not found:", invoiceError);
      return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    const { data: items, error: itemsError } = await supabase.from("invoice_items").select("*").eq("invoice_id", invoice.id);
    if (itemsError) {
      console.error("Error loading items:", itemsError);
      return new Response(JSON.stringify({ error: "Error loading items" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    const invoiceHTML = generateInvoiceHTML(invoice, items || []);
    return new Response(invoiceHTML, { status: 200, headers: { "Content-Type": "text/html" } });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal error", details: error instanceof Error ? error.message : "Unknown" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
