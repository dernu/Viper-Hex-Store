import { createClient } from "@supabase/supabase-js";
import "./style.css";

const projectUrl = import.meta.env.VITE_SUPABASE_URL;
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = projectUrl && publicKey ? createClient(projectUrl, publicKey) : null;

const sampleProducts = [
  ["Premium AI Panel", "PC External"],
  ["Ultimate Aimbot", "PC External"],
  ["Spideyhex External", "PC External"],
  ["AI Aimbot", "PC External"],
  ["BR Mods", "PC Internal"],
  ["Spidey Internal Premium", "PC Internal"],
  ["Internal Premium Pro", "PC Internal"],
  ["Bypass", "PC Bypass"],
  ["Emote Panel", "Emote Panel"],
].map(([title, category], index) => ({
  id: `preview-${index}`,
  title,
  category,
  description: "A PC performance utility from the Viper Hex collection.",
  price: null,
  asset_path: null,
  active: true,
  sort_order: index,
}));

const state = {
  session: null,
  products: [],
  orders: [],
  isAdmin: false,
  cart: new Set(),
  authMode: "signin",
  loading: true,
  filter: "All",
  receiptOrderId: null,
  message: "",
  messageType: "info",
  busy: false,
};

const app = document.querySelector("#app");
const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

const formatPrice = (price) =>
  price == null || Number(price) <= 0
    ? "Price coming soon"
    : `LKR ${Number(price).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

function showMessage(message, type = "info") {
  state.message = message;
  state.messageType = type;
  render();
}

function icon(name) {
  const paths = {
    bolt: '<path d="m13 2-3 9h7l-6 11 2-9H6l7-11Z"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 9h6v6H9zM9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    grid: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
    arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    bag: '<path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.grid}</svg>`;
}

function renderProduct(product, index) {
  const readyToBuy = Boolean(product.price && product.asset_path && product.active && supabase);
  const inCart = state.cart.has(product.id);
  const iconName = index % 3 === 0 ? "bolt" : index % 3 === 1 ? "cpu" : "star";
  return `
    <article class="product-card">
      <div class="product-art art-${index % 4}">
        <span class="product-glyph">${icon(iconName)}</span>
        <span class="product-number">VH / ${(index + 1).toString().padStart(2, "0")}</span>
        <span class="product-orbit"></span>
      </div>
      <div class="product-copy">
        <div class="product-meta"><span>${escapeHtml(product.category)}</span><span class="availability"><i></i> Digital</span></div>
        <h3>${escapeHtml(product.title)}</h3>
        <p>${escapeHtml(product.description)}</p>
        <div class="product-bottom">
          <strong>${formatPrice(product.price)}</strong>
          <button class="button button-small ${inCart ? "button-added" : "button-outline"}" data-action="cart-toggle" data-id="${escapeHtml(product.id)}" ${readyToBuy || inCart ? "" : "disabled"}>
            ${inCart ? "Added ✓" : "Add to cart"} <span aria-hidden="true">→</span>
          </button>
        </div>
        ${product.price && !product.asset_path ? '<small class="product-note">Available after the store team uploads the download.</small>' : ""}
      </div>
    </article>`;
}

function renderCart() {
  const items = state.products.filter((product) => state.cart.has(product.id));
  const total = items.reduce((sum, item) => sum + Number(item.price || 0), 0);
  return `
    <dialog class="modal" id="cart-modal">
      <div class="modal-head"><div><span class="eyebrow">YOUR BAG</span><h2>Shopping cart</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></div>
      ${items.length ? `
        <div class="cart-items">${items.map((item) => `
          <div class="cart-line">
            <div class="mini-art">${icon("grid")}</div>
            <div class="cart-line-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)}</span></div>
            <strong>${formatPrice(item.price)}</strong>
            <button class="remove-button" data-action="cart-toggle" data-id="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.title)}">×</button>
          </div>`).join("")}</div>
        <div class="cart-total"><span>Total</span><strong>${formatPrice(total)}</strong></div>
        <button class="button button-primary button-wide" data-action="open-checkout">Continue to secure checkout ${icon("arrow")}</button>
        <p class="secure-note">${icon("shield")} Payments are processed securely by PayHere.</p>
      ` : '<div class="empty-state"><span class="empty-icon">◇</span><h3>Your cart is waiting</h3><p>Add a ready-to-purchase product to get started.</p></div>'}
    </dialog>`;
}

function renderAuth() {
  const signIn = state.authMode === "signin";
  return `
    <dialog class="modal" id="auth-modal">
      <div class="modal-head"><div><span class="eyebrow">VIPER HEX ACCOUNT</span><h2>${signIn ? "Welcome back" : "Create your account"}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></div>
      <p class="modal-intro">${signIn ? "Sign in to access your orders, receipts and downloads." : "One account for purchases, receipts and your digital library."}</p>
      <form class="stack-form" data-form="auth">
        ${signIn ? "" : '<label>Full name<input name="fullName" autocomplete="name" required maxlength="100" /></label>'}
        <label>Email address<input name="email" type="email" autocomplete="email" required maxlength="254" /></label>
        <label>Password<input name="password" type="password" autocomplete="${signIn ? "current-password" : "new-password"}" minlength="8" required /></label>
        <button class="button button-primary button-wide" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "Please wait…" : signIn ? "Sign in" : "Create account"}</button>
      </form>
      <p class="switch-auth">${signIn ? "New to Viper Hex?" : "Already have an account?"} <button data-action="toggle-auth">${signIn ? "Create an account" : "Sign in"}</button></p>
    </dialog>`;
}

function renderCheckout() {
  return `
    <dialog class="modal modal-checkout" id="checkout-modal">
      <div class="modal-head"><div><span class="eyebrow">SECURE CHECKOUT</span><h2>Billing details</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></div>
      <p class="modal-intro">Pay securely with PayHere. Your download unlocks after PayHere confirms payment.</p>
      <form class="stack-form" data-form="checkout">
        <div class="form-row">
          <label>First name<input name="firstName" autocomplete="given-name" required maxlength="80" /></label>
          <label>Last name<input name="lastName" autocomplete="family-name" required maxlength="80" /></label>
        </div>
        <label>Phone<input name="phone" type="tel" autocomplete="tel" required maxlength="24" /></label>
        <label>Billing address<input name="address" autocomplete="street-address" required maxlength="120" /></label>
        <div class="form-row">
          <label>City<input name="city" autocomplete="address-level2" required maxlength="80" /></label>
          <label>Country<input name="country" autocomplete="country-name" value="Sri Lanka" required maxlength="80" /></label>
        </div>
        <button class="button button-primary button-wide" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "Preparing secure checkout…" : "Continue to PayHere"} ${icon("arrow")}</button>
      </form>
      <p class="secure-note">${icon("shield")} Card details are entered on PayHere's secure checkout.</p>
    </dialog>`;
}

function renderOrders() {
  if (!state.session) return "";
  return `
    <section class="account-section section-shell" id="account">
      <div class="section-heading">
        <div><span class="eyebrow">YOUR ACCOUNT</span><h2>Orders & downloads</h2><p>Receipts and digital purchases, all in one place.</p></div>
        <button class="button button-outline" data-action="sign-out">Sign out</button>
      </div>
      ${state.loading ? '<div class="inline-loading">Loading your account…</div>' : state.orders.length ? `
        <div class="orders-list">${state.orders.map((order) => `
          <article class="order-card">
            <div class="order-top">
              <div><span class="eyebrow">ORDER</span><strong>${escapeHtml(order.order_id)}</strong></div>
              <div class="order-actions">
                <span class="status status-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
                ${order.status === "paid" ? `<button class="receipt-button" data-action="receipt" data-order-id="${escapeHtml(order.id)}">Receipt</button>` : ""}
              </div>
            </div>
            <div class="order-products">${(order.order_items ?? []).map((item) => `
              <div class="order-item">
                <span>${escapeHtml(item.product_name)}</span>
                <span>${formatPrice(item.unit_price)}</span>
                ${order.status === "paid" && item.asset_path ? `<button class="download-button" data-action="download" data-item-id="${escapeHtml(item.id)}">${icon("download")} Download</button>` : ""}
              </div>`).join("")}</div>
            <div class="order-footer"><span>${new Date(order.created_at).toLocaleDateString()}</span><strong>Total ${formatPrice(order.total_amount)}</strong></div>
          </article>`).join("")}</div>
      ` : '<div class="empty-state empty-inline"><span class="empty-icon">◇</span><h3>No orders yet</h3><p>Your paid orders and receipts will appear here.</p></div>'}
    </section>`;
}

function renderReceipt() {
  const order = state.orders.find((item) => item.id === state.receiptOrderId);
  if (!order) return '<dialog class="modal" id="receipt-modal"></dialog>';
  return `
    <dialog class="modal receipt-modal" id="receipt-modal">
      <div class="modal-head receipt-controls"><div><span class="eyebrow">VIPER HEX / PAYMENT RECEIPT</span><h2>Purchase receipt</h2></div><div><button class="button button-outline button-small" data-action="print-receipt">Print / Save PDF</button><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></div></div>
      <div class="receipt-paper">
        <div class="receipt-brand"><span class="brand-mark">VH</span><span class="brand-name">VIPER<span>HEX</span></span></div>
        <div class="receipt-title"><span>PAYMENT RECEIPT</span><strong>${escapeHtml(order.order_id)}</strong></div>
        <div class="receipt-detail"><span>Payment status</span><strong>Paid</strong></div>
        <div class="receipt-detail"><span>Payment reference</span><strong>${escapeHtml(order.payment_id || "PayHere")}</strong></div>
        <div class="receipt-detail"><span>Purchase date</span><strong>${new Date(order.created_at).toLocaleString()}</strong></div>
        <div class="receipt-lines">${(order.order_items ?? []).map((item) => `<div><span>${escapeHtml(item.product_name)}</span><strong>${formatPrice(item.unit_price)}</strong></div>`).join("")}</div>
        <div class="receipt-total"><span>Total paid</span><strong>${formatPrice(order.total_amount)}</strong></div>
        <p>Thank you for supporting the Viper Hex community.</p>
      </div>
    </dialog>`;
}

function renderAdmin() {
  if (!state.isAdmin) return "";
  return `
    <section class="admin-section section-shell" id="admin">
      <div class="section-heading">
        <div><span class="eyebrow">STORE MANAGEMENT</span><h2>Admin dashboard</h2><p>Update product details, pricing, availability and secure downloads.</p></div>
        <span class="admin-badge">${icon("shield")} Admin access</span>
      </div>
      <form class="admin-create" data-form="new-product">
        <h3>Add a product</h3>
        <div class="admin-create-fields">
          <label>Product name<input name="title" required maxlength="120" placeholder="Product name" /></label>
          <label>Category<input name="category" required maxlength="80" placeholder="PC External" /></label>
          <label>Description<input name="description" maxlength="500" placeholder="Short product description" /></label>
          <button class="button button-primary" type="submit">Add product</button>
        </div>
      </form>
      <div class="admin-product-list">
        ${state.products.map((product) => `
          <form class="admin-product" data-form="edit-product" data-id="${escapeHtml(product.id)}">
            <div class="admin-product-title"><span class="mini-art">${icon("grid")}</span><strong>${escapeHtml(product.title)}</strong></div>
            <div class="admin-fields">
              <label>Name<input name="title" value="${escapeHtml(product.title)}" maxlength="120" required /></label>
              <label>Category<input name="category" value="${escapeHtml(product.category)}" maxlength="80" required /></label>
              <label>Description<input name="description" value="${escapeHtml(product.description)}" maxlength="500" /></label>
              <label>Price (LKR)<input name="price" type="number" min="0.01" step="0.01" value="${Number(product.price) > 0 ? escapeHtml(product.price) : ""}" placeholder="Set price" /></label>
              <label class="checkbox-label"><input name="active" type="checkbox" ${product.active ? "checked" : ""} /> Visible in store</label>
            </div>
            <div class="admin-upload-row">
              <label class="file-label">Secure download file<input name="file" type="file" accept=".zip,.7z,.rar,.exe,application/octet-stream,application/zip" /></label>
              <span class="file-status">${product.asset_path ? "Download file uploaded" : "No file uploaded"}</span>
              <button class="button button-outline button-small" type="submit">Save changes</button>
            </div>
          </form>`).join("")}
      </div>
      <h3 class="admin-orders-heading">Recent orders</h3>
      ${state.orders.length ? `<div class="admin-order-list">${state.orders.slice(0, 20).map((order) => `
        <div class="admin-order"><span>${escapeHtml(order.order_id)}</span><span>${escapeHtml(order.status)}</span><strong>${formatPrice(order.total_amount)}</strong><time>${new Date(order.created_at).toLocaleDateString()}</time></div>`).join("")}</div>` : '<p class="muted">No orders yet.</p>'}
    </section>`;
}

function render() {
  const storeProducts = state.products.filter((product) => product.active);
  const categories = ["All", ...new Set(storeProducts.map((product) => product.category))];
  const visibleProducts = storeProducts.filter(
    (product) => state.filter === "All" || product.category === state.filter,
  );
  const cartCount = state.cart.size;
  const paymentStatus = new URLSearchParams(location.search).get("payment");
  const banner = state.message || (!supabase
    ? "Preview mode — connect Supabase to enable accounts, products and checkout."
    : "");

  app.innerHTML = `
    ${banner ? `<div class="notice notice-${state.message ? escapeHtml(state.messageType) : "info"}" role="status"><span>${escapeHtml(banner)}</span><button data-action="dismiss-message" aria-label="Dismiss">×</button></div>` : ""}
    ${paymentStatus === "return" ? '<div class="notice notice-info" role="status"><span>Thanks for checking out. PayHere will confirm the payment shortly; check your orders for the latest status.</span><button data-action="dismiss-payment" aria-label="Dismiss">×</button></div>' : ""}
    ${paymentStatus === "cancel" ? '<div class="notice notice-info" role="status"><span>Checkout was cancelled. Your order will remain unpaid.</span><button data-action="dismiss-payment" aria-label="Dismiss">×</button></div>' : ""}
    <header class="site-header">
      <a class="brand" href="#" aria-label="Viper Hex home"><span class="brand-mark">VH</span><span class="brand-name">VIPER<span>HEX</span></span></a>
      <nav class="main-nav" aria-label="Main navigation"><a href="#store">Store</a><a href="#about">About</a>${state.session ? '<a href="#account">My orders</a>' : ""}${state.isAdmin ? '<a href="#admin">Manage</a>' : ""}</nav>
      <div class="header-actions">
        ${state.session ? `<button class="button button-quiet account-button" data-action="account">${icon("user")}<span>${escapeHtml(state.session.user.email)}</span></button>` : '<button class="button button-quiet" data-action="open-auth">Sign in</button>'}
        <button class="button button-cart" data-action="open-cart" aria-label="Open shopping cart">${icon("bag")}<span>Cart</span><b>${cartCount}</b></button>
      </div>
    </header>
    <main>
      <section class="hero">
        <div class="hero-grid"></div>
        <div class="hero-content">
          <div class="hero-kicker"><span class="live-dot"></span> PERFORMANCE, REFINED <span class="kicker-line"></span> EST. 2024</div>
          <h1>Make every<br />moment <span>count.</span></h1>
          <p>Purpose-built PC performance tools, designed with the Viper Hex community in mind.</p>
          <div class="hero-actions"><a class="button button-primary" href="#store">Explore the store ${icon("arrow")}</a><span class="hero-caption">${icon("shield")} Secure checkout · Digital delivery</span></div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="hero-halo"></div><div class="hero-ring ring-one"></div><div class="hero-ring ring-two"></div>
          <div class="hero-core"><span class="hero-vh">VH</span><span class="core-orbit orbit-a"></span><span class="core-orbit orbit-b"></span></div>
          <div class="visual-label label-top">SYSTEM / 01 <i></i></div><div class="visual-label label-bottom">OPTIMIZE YOUR SETUP</div>
          <div class="visual-stats"><span>TOOLS</span><strong>09</strong></div>
        </div>
        <div class="hero-index"><span>01</span> / 03 <i></i> SCROLL TO EXPLORE</div>
      </section>
      <section class="trust-strip" aria-label="Store benefits">
        <div>${icon("shield")}<span><strong>Secure payments</strong><small>Protected PayHere checkout</small></span></div>
        <div>${icon("download")}<span><strong>Digital delivery</strong><small>Private, account-linked downloads</small></span></div>
        <div>${icon("user")}<span><strong>Your library</strong><small>Orders and receipts in one place</small></span></div>
      </section>
      <section class="store-section section-shell" id="store">
        <div class="section-heading">
          <div><span class="eyebrow">THE COLLECTION / 2026</span><h2>Find your next edge.</h2><p>Explore our PC performance collection.</p></div>
          <div class="collection-count"><strong>${String(storeProducts.length).padStart(2, "0")}</strong><span>PRODUCTS<br/>AVAILABLE</span></div>
        </div>
        <div class="filter-row">${categories.map((category) => `<button class="filter-chip ${state.filter === category ? "active" : ""}" data-action="filter" data-category="${escapeHtml(category)}">${escapeHtml(category)}${category === "All" ? `<span>${storeProducts.length}</span>` : ""}</button>`).join("")}</div>
        ${state.loading ? '<div class="inline-loading">Loading the collection…</div>' : visibleProducts.length ? `<div class="product-grid">${visibleProducts.map(renderProduct).join("")}</div>` : '<div class="empty-state empty-inline"><span class="empty-icon">◇</span><h3>No products in this collection</h3><p>Choose another category to browse.</p></div>'}
      </section>
      ${renderOrders()}
      ${renderAdmin()}
      <section class="about-section section-shell" id="about">
        <div class="about-mark"><span>VH</span><i></i></div>
        <div class="about-copy"><span class="eyebrow">BUILT FOR THE COMMUNITY</span><h2>Performance is<br/><span>personal.</span></h2><p>Viper Hex brings together a community-focused collection of PC tools. Shop securely, keep your purchase history close, and get support when you need it.</p><a class="text-link" href="#store">Discover the collection ${icon("arrow")}</a></div>
        <div class="about-side"><span>OUR STANDARD</span><strong>Secure by design.<br/>Made for your setup.</strong><i></i><small>VIPER HEX / DIGITAL STORE</small></div>
      </section>
    </main>
    <footer class="site-footer"><a class="brand" href="#"><span class="brand-mark">VH</span><span class="brand-name">VIPER<span>HEX</span></span></a><span>© ${new Date().getFullYear()} Viper Hex Community</span><span class="footer-secure">${icon("shield")} Secure storefront</span></footer>
    ${renderCart()}${renderAuth()}${renderCheckout()}${renderReceipt()}`;

  for (const id of ["cart-modal", "auth-modal", "checkout-modal", "receipt-modal"]) {
    const dialog = document.getElementById(id);
    dialog?.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }
}

async function loadProducts() {
  if (!supabase) {
    state.products = sampleProducts;
    state.loading = false;
    render();
    return;
  }
  const { data, error } = await supabase
    .from("products")
    .select("id,title,category,description,price,asset_path,active,sort_order")
    .eq("active", true)
    .order("sort_order")
    .order("title");
  if (error) {
    state.loading = false;
    state.products = [];
    showMessage(`Could not load the store catalogue: ${error.message}`, "error");
    return;
  }
  state.products = data ?? [];
  state.loading = false;
  render();
}

async function loadAccount() {
  if (!supabase || !state.session) {
    state.orders = [];
    state.isAdmin = false;
    render();
    return;
  }
  state.loading = true;
  render();
  const [adminResult, orderResult] = await Promise.all([
    supabase.rpc("is_store_admin"),
    supabase
      .from("orders")
      .select("id,order_id,total_amount,currency,status,payment_id,created_at,order_items(id,product_name,unit_price,asset_path)")
      .order("created_at", { ascending: false }),
  ]);
  if (adminResult.error) {
    state.isAdmin = false;
    state.loading = false;
    showMessage(`Could not verify admin access: ${adminResult.error.message}`, "error");
    return;
  }
  if (orderResult.error) {
    state.loading = false;
    showMessage(`Could not load order history: ${orderResult.error.message}`, "error");
    return;
  }
  state.isAdmin = Boolean(adminResult.data);
  state.orders = orderResult.data ?? [];
  if (state.isAdmin) {
    const { data, error } = await supabase
      .from("products")
      .select("id,title,category,description,price,asset_path,active,sort_order")
      .order("sort_order")
      .order("title");
    if (error) {
      state.loading = false;
      showMessage(`Could not load admin products: ${error.message}`, "error");
      return;
    }
    state.products = data ?? [];
  }
  state.loading = false;
  render();
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog && !dialog.open) dialog.showModal();
}

async function handleAuth(form) {
  if (!supabase) return showMessage("Connect Supabase before enabling accounts.", "error");
  const data = new FormData(form);
  const email = String(data.get("email")).trim();
  const password = String(data.get("password"));
  state.busy = true;
  render();
  const result = state.authMode === "signin"
    ? await supabase.auth.signInWithPassword({ email, password })
    : await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: String(data.get("fullName")).trim() },
          emailRedirectTo: location.origin,
        },
      });
  state.busy = false;
  if (result.error) {
    showMessage(`Account request failed: ${result.error.message}`, "error");
    return;
  }
  document.getElementById("auth-modal")?.close();
  if (state.authMode === "signup" && !result.data.session) {
    showMessage("Check your email to confirm your new account, then sign in.", "success");
  } else {
    showMessage(state.authMode === "signup" ? "Your account is ready." : "You're signed in.", "success");
  }
}

async function handleCheckout(form) {
  if (!supabase) return showMessage("Connect Supabase and configure PayHere to accept payments.", "error");
  if (!state.session) {
    document.getElementById("checkout-modal")?.close();
    return openDialog("auth-modal");
  }
  const data = new FormData(form);
  state.busy = true;
  render();
  const { data: checkout, error } = await supabase.functions.invoke("create-payhere-checkout", {
    body: {
      productIds: [...state.cart],
      firstName: String(data.get("firstName")).trim(),
      lastName: String(data.get("lastName")).trim(),
      phone: String(data.get("phone")).trim(),
      address: String(data.get("address")).trim(),
      city: String(data.get("city")).trim(),
      country: String(data.get("country")).trim(),
    },
  });
  state.busy = false;
  if (error || !checkout?.action || !checkout?.fields) {
    const detail = error?.message ?? checkout?.error ?? "Unknown checkout error.";
    showMessage(`Could not start secure checkout: ${detail}`, "error");
    return;
  }
  const paymentForm = document.createElement("form");
  paymentForm.method = "POST";
  paymentForm.action = checkout.action;
  for (const [name, value] of Object.entries(checkout.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value);
    paymentForm.append(input);
  }
  document.body.append(paymentForm);
  paymentForm.submit();
}

async function saveProduct(form) {
  const productId = form.dataset.id;
  const data = new FormData(form);
  const rawPrice = String(data.get("price")).trim();
  const update = {
    title: String(data.get("title")).trim(),
    category: String(data.get("category")).trim(),
    description: String(data.get("description")).trim(),
    price: rawPrice ? Number(rawPrice) : 0,
    active: data.get("active") === "on",
    updated_at: new Date().toISOString(),
  };
  if (rawPrice && (!Number.isFinite(update.price) || update.price <= 0)) {
    return showMessage("Enter a valid product price greater than zero.", "error");
  }
  const file = data.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 500 * 1024 * 1024) return showMessage("Product files must be smaller than 500 MB.", "error");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const path = `${productId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("product-files")
      .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
    if (uploadError) return showMessage(`File upload failed: ${uploadError.message}`, "error");
    update.asset_path = path;
  }
  const { error } = await supabase.from("products").update(update).eq("id", productId);
  if (error) {
    if (update.asset_path) {
      const { error: cleanupError } = await supabase.storage
        .from("product-files")
        .remove([update.asset_path]);
      if (cleanupError) {
        return showMessage(
          `Could not save product: ${error.message}. The uploaded file also needs cleanup: ${cleanupError.message}`,
          "error",
        );
      }
    }
    return showMessage(`Could not save product: ${error.message}`, "error");
  }
  await loadAccount();
  showMessage("Product updated.", "success");
}

async function addProduct(form) {
  const data = new FormData(form);
  const { error } = await supabase.from("products").insert({
    title: String(data.get("title")).trim(),
    category: String(data.get("category")).trim(),
    description: String(data.get("description")).trim(),
    active: true,
    sort_order: state.products.length + 1,
  });
  if (error) return showMessage(`Could not add product: ${error.message}`, "error");
  await loadAccount();
  showMessage("Product added. Set its price and upload its secure download before purchase.", "success");
}

async function downloadOrderItem(orderItemId) {
  const { data, error } = await supabase.functions.invoke("create-download-link", {
    body: { orderItemId },
  });
  if (error || !data?.url) {
    showMessage(`Could not prepare download: ${error?.message ?? data?.error ?? "Unknown error."}`, "error");
    return;
  }
  location.assign(data.url);
}

app.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "open-auth") {
    state.authMode = "signin";
    render();
    return openDialog("auth-modal");
  }
  if (action === "open-cart") return openDialog("cart-modal");
  if (action === "close-modal") return button.closest("dialog")?.close();
  if (action === "toggle-auth") {
    state.authMode = state.authMode === "signin" ? "signup" : "signin";
    render();
    return openDialog("auth-modal");
  }
  if (action === "cart-toggle") {
    if (state.cart.has(button.dataset.id)) state.cart.delete(button.dataset.id);
    else state.cart.add(button.dataset.id);
    const dialogWasOpen = document.getElementById("cart-modal")?.open;
    render();
    if (dialogWasOpen) openDialog("cart-modal");
    return;
  }
  if (action === "filter") {
    state.filter = button.dataset.category;
    return render();
  }
  if (action === "open-checkout") {
    document.getElementById("cart-modal")?.close();
    if (!state.session) {
      state.authMode = "signin";
      render();
      openDialog("auth-modal");
      return showMessage("Sign in or create an account to continue.", "info");
    }
    return openDialog("checkout-modal");
  }
  if (action === "sign-out") {
    const { error } = await supabase.auth.signOut();
    if (error) return showMessage(`Could not sign out: ${error.message}`, "error");
    state.session = null;
    state.orders = [];
    state.isAdmin = false;
    return showMessage("You have signed out.", "success");
  }
  if (action === "account") return document.querySelector("#account")?.scrollIntoView({ behavior: "smooth" });
  if (action === "download") return downloadOrderItem(button.dataset.itemId);
  if (action === "receipt") {
    state.receiptOrderId = button.dataset.orderId;
    render();
    return openDialog("receipt-modal");
  }
  if (action === "print-receipt") return window.print();
  if (action === "dismiss-message") {
    state.message = "";
    return render();
  }
  if (action === "dismiss-payment") {
    history.replaceState(null, "", location.pathname + location.hash);
    return render();
  }
});

app.addEventListener("submit", async (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const type = form.dataset.form;
  if (type === "auth") return handleAuth(form);
  if (type === "checkout") return handleCheckout(form);
  if (type === "new-product") return addProduct(form);
  if (type === "edit-product") return saveProduct(form);
});

render();

if (supabase) {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showMessage(`Could not restore your session: ${error.message}`, "error");
    await loadProducts();
  } else {
    state.session = data.session;
    if (state.session) {
      await loadAccount();
      if (!state.isAdmin) await loadProducts();
    } else {
      await loadProducts();
    }
  }
  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    if (session) void loadAccount();
    else {
      state.orders = [];
      state.isAdmin = false;
      render();
    }
  });
} else {
  await loadProducts();
}
