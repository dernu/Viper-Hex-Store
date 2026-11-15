import { createClient } from "npm:@supabase/supabase-js@2";
import md5 from "npm:md5@2.3.0";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const merchantId = Deno.env.get("PAYHERE_MERCHANT_ID");
  const merchantSecret = Deno.env.get("PAYHERE_MERCHANT_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !merchantId || !merchantSecret) {
    console.error("PayHere notification endpoint is not configured.");
    return new Response("Not configured", { status: 503 });
  }

  const form = await request.formData();
  const value = (key: string) => String(form.get(key) ?? "");
  const suppliedMerchantId = value("merchant_id");
  const orderId = value("order_id");
  const amount = value("payhere_amount");
  const currency = value("payhere_currency");
  const statusCode = value("status_code");
  const suppliedSignature = value("md5sig").toUpperCase();
  const expectedSignature = md5(
    suppliedMerchantId +
      orderId +
      amount +
      currency +
      statusCode +
      md5(merchantSecret).toUpperCase(),
  ).toUpperCase();

  if (
    suppliedMerchantId !== merchantId ||
    !orderId ||
    !/^[0-9A-F]{32}$/.test(suppliedSignature) ||
    suppliedSignature !== expectedSignature
  ) {
    return new Response("Invalid notification", { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, total_amount, currency, status")
    .eq("order_id", orderId)
    .maybeSingle();
  if (orderError) {
    console.error("Could not find PayHere order.", orderError);
    return new Response("Order lookup failed", { status: 500 });
  }
  if (!order) return new Response("Order not found", { status: 404 });

  const receivedAmount = Number(amount);
  if (
    !Number.isFinite(receivedAmount) ||
    receivedAmount.toFixed(2) !== Number(order.total_amount).toFixed(2) ||
    currency !== order.currency
  ) {
    return new Response("Payment does not match order", { status: 400 });
  }

  const statusByCode: Record<string, string> = {
    "2": "paid",
    "0": "pending",
    "-1": "cancelled",
    "-2": "failed",
    "-3": "chargedback",
  };
  const nextStatus = statusByCode[statusCode];
  if (!nextStatus) return new Response("Unknown payment status", { status: 400 });
  if (order.status === "paid" && nextStatus !== "chargedback") {
    return new Response("OK", { status: 200 });
  }
  if (order.status === "chargedback" && nextStatus !== "chargedback") {
    return new Response("OK", { status: 200 });
  }

  const { error: updateError } = await admin
    .from("orders")
    .update({
      status: nextStatus,
      payment_id: value("payment_id") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("status", order.status);
  if (updateError) {
    console.error("Could not update PayHere order status.", updateError);
    return new Response("Order update failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
