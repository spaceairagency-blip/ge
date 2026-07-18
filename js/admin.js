let CURRENT_PRODUCTS = [];

// ---------- auth ----------
async function initAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    showAdmin();
  } else {
    showLogin();
  }

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errEl = document.getElementById("loginErr");
    errEl.textContent = "";

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      errEl.textContent = error.message;
      return;
    }
    showAdmin();
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    location.reload();
  });
}

function showLogin() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("adminScreen").classList.add("hidden");
}

function showAdmin() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("adminScreen").classList.remove("hidden");
  loadProductsAdmin();
  loadOrders();
  loadCodes();
}

// ---------- products ----------
async function loadProductsAdmin() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) { toast("Couldn't load products: " + error.message); return; }
  CURRENT_PRODUCTS = data || [];
  renderProductTable();
}

function renderProductTable() {
  const tbody = document.getElementById("productTableBody");
  if (!CURRENT_PRODUCTS.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="opacity:.6">No products yet — add one above.</td></tr>`;
    return;
  }
  tbody.innerHTML = CURRENT_PRODUCTS.map(p => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category || "General")}</td>
      <td><span class="pill ${p.is_active ? "avail" : "used"}">${p.is_active ? "Active" : "Hidden"}</span></td>
      <td>${new Date(p.created_at).toLocaleDateString()}</td>
      <td>
        <button class="icon-btn" data-toggle="${p.id}">${p.is_active ? "Hide" : "Show"}</button>
        &nbsp;|&nbsp;
        <button class="icon-btn" data-delete="${p.id}">Delete</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", () => toggleProduct(btn.dataset.toggle));
  });
  tbody.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => deleteProduct(btn.dataset.delete));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("productForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("pName").value.trim();
    const category = document.getElementById("pCategory").value.trim() || "General";
    const image_url = document.getElementById("pImage").value.trim();
    const description = document.getElementById("pDesc").value.trim();

    const { error } = await supabaseClient.from("products").insert({
      name, category, image_url, description,
    });

    if (error) { toast("Error adding product: " + error.message); return; }
    toast("Product added.");
    e.target.reset();
    loadProductsAdmin();
  });

  document.getElementById("genCodesForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const count = parseInt(document.getElementById("codeCount").value, 10) || 1;

    const rows = Array.from({ length: count }, () => ({ code: generateCode() }));

    const { error } = await supabaseClient.from("redeem_codes").insert(rows);
    if (error) { toast("Error generating codes: " + error.message); return; }
    toast(`Generated ${count} code${count > 1 ? "s" : ""}. Any code redeems any product.`);
    loadCodes();
  });
});

async function toggleProduct(id) {
  const p = CURRENT_PRODUCTS.find(x => x.id === id);
  const { error } = await supabaseClient.from("products").update({ is_active: !p.is_active }).eq("id", id);
  if (error) { toast("Error: " + error.message); return; }
  loadProductsAdmin();
}

async function deleteProduct(id) {
  if (!confirm("Delete this product and all its redeem codes? This can't be undone.")) return;
  const { error } = await supabaseClient.from("products").delete().eq("id", id);
  if (error) { toast("Error: " + error.message); return; }
  toast("Product deleted.");
  loadProductsAdmin();
}

// ---------- redeem codes ----------
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const block = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${block()}-${block()}`;
}

async function loadCodes() {
  const { data, error } = await supabaseClient
    .from("redeem_codes")
    .select("*")
    .order("created_at", { ascending: false });

  const tbody = document.getElementById("codeTableBody");
  if (error) { tbody.innerHTML = `<tr><td colspan="4">Error loading codes.</td></tr>`; return; }
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="4" style="opacity:.6">No codes yet — generate some above.</td></tr>`; return; }

  tbody.innerHTML = data.map(c => `
    <tr>
      <td style="font-family:'Fraunces',serif; letter-spacing:.08em;">${escapeHtml(c.code)}</td>
      <td><span class="pill ${c.is_used ? "used" : "avail"}">${c.is_used ? "Redeemed" : "Available"}</span></td>
      <td>${c.used_by_name ? escapeHtml(c.used_by_name) + " (" + escapeHtml(c.used_by_email || "") + ")" : "—"}</td>
      <td>${c.used_at ? new Date(c.used_at).toLocaleString() : "—"}</td>
    </tr>
  `).join("");
}

// ---------- orders ----------
async function loadOrders() {
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*, products(name)")
    .order("created_at", { ascending: false });

  const tbody = document.getElementById("orderTableBody");
  if (error) { tbody.innerHTML = `<tr><td colspan="4">Error loading orders.</td></tr>`; return; }
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="4" style="opacity:.6">No orders yet.</td></tr>`; return; }

  tbody.innerHTML = data.map(o => `
    <tr>
      <td>${escapeHtml(o.products?.name || "—")}</td>
      <td>${escapeHtml(o.buyer_name)}</td>
      <td>${escapeHtml(o.buyer_email || "")}</td>
      <td>${new Date(o.created_at).toLocaleString()}</td>
    </tr>
  `).join("");
}

// ---------- helpers ----------
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

initAuth();
