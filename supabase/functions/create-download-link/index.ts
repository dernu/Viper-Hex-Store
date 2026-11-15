import { createClient } from "npm:@supabase/supabase-js@2";

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
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Downloads are not configured yet." }, 503);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Sign in to download your purchase." }, 401);
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Please sign in again." }, 401);

  let input: { orderItemId?: unknown };
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid download request." }, 400);
  }
  if (typeof input.orderItemId !== "string") {
    return json({ error: "Choose a purchased product to download." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: item, error: itemError } = await admin
    .from("order_items")
    .select("asset_path, orders!inner(user_id, status)")
    .eq("id", input.orderItemId)
    .eq("orders.user_id", userData.user.id)
    .eq("orders.status", "paid")
    .maybeSingle();
  if (itemError) {
    console.error("Could not look up purchased download.", itemError);
    return json({ error: "Could not prepare your download." }, 500);
  }
  if (!item) return json({ error: "This paid purchase was not found." }, 404);
  if (!item.asset_path) {
    return json({ error: "This purchase has no download file attached yet." }, 409);
  }

  const { data: signed, error: signedError } = await admin.storage
    .from("product-files")
    .createSignedUrl(item.asset_path, 60 * 5);
  if (signedError || !signed?.signedUrl) {
    console.error("Could not create product download link.", signedError);
    return json({ error: "Could not prepare your download." }, 500);
  }
  return json({ url: signed.signedUrl });
});
