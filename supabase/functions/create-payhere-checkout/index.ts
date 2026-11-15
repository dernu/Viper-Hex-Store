import { createClient } from "npm:@supabase/supabase-js@2";
import md5 from "npm:md5@2.3.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const merchantId = Deno.env.get("PAYHERE_MERCHANT_ID");
  const merchantSecret = Deno.env.get("PAYHERE_MERCHANT_SECRET");
  const siteUrl = Deno.env.get("SITE_URL");
  const sandbox = Deno.env.get("PAYHERE_SANDBOX") === "true";
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !merchantId || !merchantSecret || !siteUrl) {
    return json({ error: "Checkout is not configured yet. Please contact the store." }, 503);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Sign in before checking out." }, 401);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user?.email) return json({ error: "Please sign in again." }, 401);

  let input: {
    productIds?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    phone?: unknown;
    address?: unknown;
    city?: unknown;
    country?: unknown;
  };
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid checkout request." }, 400);
  }

  const productIds = Array.isArray(input.productIds)
    ? [...new Set(input.productIds.filter((value): value is string => typeof value === "string"))]
    : [];
  if (productIds.length < 1 || productIds.length > 10) {
    return json({ error: "Choose between 1 and 10 products." }, 400);
  }

  const customer = {
    first_name: String(input.firstName ?? "").trim(),
    last_name: String(input.lastName ?? "").trim(),
    phone: String(input.phone ?? "").trim(),
    address: String(input.address ?? "").trim(),
    city: String(input.city ?? "").trim(),
    country: String(input.country ?? "").trim(),
  };
  if (
    Object.values(customer).some((value) => !value || value.length > 120) ||
    customer.phone.length < 7
  ) {
    return json({ error: "Enter valid contact and billing details." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: products, error: productError } = await admin
    .from("products")
    .select("id, title, price, asset_path, active")
    .in("id", productIds);
  if (productError) {
    console.error("Could not load products for checkout.", productError);
    return json({ error: "Could not prepare your order. Please try again." }, 500);
  }
  if (
    !products ||
    products.length !== productIds.length ||
    products.some(
      (product) =>
        !product.active ||
        !Number.isFinite(Number(product.price)) ||
        Number(product.price) <= 0 ||
        !product.asset_path,
    )
  ) {
    return json({ error: "One or more products are not ready for purchase." }, 409);
  }

  const total = products.reduce((sum, product) => sum + Number(product.price), 0);
  const orderId = `VH-${crypto.randomUUID()}`;
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      order_id: orderId,
      user_id: userData.user.id,
      total_amount: total.toFixed(2),
      currency: "LKR",
      status: "pending",
    })
    .select("id")
    .single();
  if (orderError || !order) {
    console.error("Could not create pending order.", orderError);
    return json({ error: "Could not prepare your order. Please try again." }, 500);
  }

  const { error: itemsError } = await admin.from("order_items").insert(
    products.map((product) => ({
      order_id: order.id,
      product_id: product.id,
      product_name: product.title,
      unit_price: product.price,
      asset_path: product.asset_path,
    })),
  );
  if (itemsError) {
    console.error("Could not create order items.", itemsError);
    await admin.from("orders").delete().eq("id", order.id);
    return json({ error: "Could not prepare your order. Please try again." }, 500);
  }

  const amount = total.toFixed(2);
  const hash = md5(
    merchantId + orderId + amount + "LKR" + md5(merchantSecret).toUpperCase(),
  ).toUpperCase();
  const fields: Record<string, string> = {
    merchant_id: merchantId,
    return_url: `${siteUrl}/?payment=return&order_id=${encodeURIComponent(orderId)}`,
    cancel_url: `${siteUrl}/?payment=cancel&order_id=${encodeURIComponent(orderId)}`,
    notify_url: `${supabaseUrl}/functions/v1/payhere-notify`,
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: userData.user.email,
    phone: customer.phone,
    address: customer.address,
    city: customer.city,
    country: customer.country,
    order_id: orderId,
    items: products.map((product) => product.title).join(", ").slice(0, 200),
    currency: "LKR",
    amount,
    hash,
  };
  products.forEach((product, index) => {
    const position = index + 1;
    fields[`item_name_${position}`] = product.title;
    fields[`item_number_${position}`] = product.id;
    fields[`amount_${position}`] = Number(product.price).toFixed(2);
    fields[`quantity_${position}`] = "1";
  });

  return json({
    orderId,
    action: sandbox
      ? "https://sandbox.payhere.lk/pay/checkout"
      : "https://www.payhere.lk/pay/checkout",
    fields,
  });
});
