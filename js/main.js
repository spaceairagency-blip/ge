let ALL_PRODUCTS = [];
let ACTIVE_CATEGORY = "All";

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    document.getElementById("grid").innerHTML =
      `<div class="empty-state">Couldn't load products. Check your Supabase config in js/config.js.</div>`;
    return;
  }
  ALL_PRODUCTS = data || [];
  renderTabs();
  renderGrid();
}

function renderTabs() {
  const cats = ["All", ...new Set(ALL_PRODUCTS.map(p => p.category || "General"))];
  const tabs = document.getElementById("tabs");
  tabs.innerHTML = cats.map(c =>
    `<button class="tab ${c === ACTIVE_CATEGORY ? "active" : ""}" data-cat="${escapeAttr(c)}">${escapeHtml(c)}</button>`
  ).join("");
  tabs.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      ACTIVE_CATEGORY = btn.dataset.cat;
      renderTabs();
      renderGrid();
    });
  });
}

function renderGrid() {
  const grid = document.getElementById("grid");
  const list = ACTIVE_CATEGORY === "All"
    ? ALL_PRODUCTS
    : ALL_PRODUCTS.filter(p => (p.category || "General") === ACTIVE_CATEGORY);

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state">No pieces here yet — check back soon.</div>`;
    return;
  }

  grid.innerHTML = list.map(p => `
    <div class="card" data-id="${p.id}">
      <div class="img" style="background-image:url('${escapeAttr(p.image_url || placeholderImg())}')">
        <span class="tag">${escapeHtml(p.category || "General")}</span>
      </div>
      <div class="body">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="desc">${escapeHtml(truncate(p.description || "", 90))}</div>
        <div class="row">
          <span class="redeem-cta">Redeem &rarr;</span>
        </div>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => openModal(card.dataset.id));
  });
}

function openModal(productId) {
  const p = ALL_PRODUCTS.find(x => x.id === productId);
  if (!p) return;

  const backdrop = document.getElementById("modalBackdrop");
  backdrop.innerHTML = `
    <div class="modal">
      <button class="close" aria-label="Close">&times;</button>
      <div class="m-img" style="background-image:url('${escapeAttr(p.image_url || placeholderImg())}')"></div>
      <div class="m-body">
        <div class="cat">${escapeHtml(p.category || "General")}</div>
        <h2>${escapeHtml(p.name)}</h2>
        <div class="desc">${escapeHtml(p.description || "")}</div>

        <div class="redeem-box" id="redeemBox">
          <div class="label">Have a redeem code? Claim this piece — no payment needed.</div>
          <form class="redeem-form" id="redeemForm">
            <input type="text" class="code-input" id="codeInput" placeholder="XXXX-XXXX" maxlength="24" required autocomplete="off">
            <input type="text" id="nameInput" placeholder="Full name" >
            <input type="email" id="emailInput" placeholder="Email" value="abc@gmail.com">
            <button type="submit" class="btn btn-redeem" id="redeemBtn">Redeem this piece</button>
            <div class="form-msg" id="formMsg"></div>
          </form>
        </div>
      </div>
    </div>
  `;

  backdrop.classList.add("open");
  backdrop.querySelector(".close").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });

  document.getElementById("redeemForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitRedeem(p);
  });
}

async function submitRedeem(product) {
  const btn = document.getElementById("redeemBtn");
  const msg = document.getElementById("formMsg");
  const code = document.getElementById("codeInput").value.trim();
  const name = document.getElementById("nameInput").value.trim();
  const email = document.getElementById("emailInput").value.trim();

  btn.disabled = true;
  btn.textContent = "Checking code…";
  msg.textContent = "";
  msg.className = "form-msg";

  const { data, error } = await supabaseClient.rpc("redeem_code", {
    p_code: code,
    p_product_id: product.id,
    p_buyer_name: name,
    p_buyer_email: email,
  });

  if (error) {
    msg.textContent = "Something went wrong. Please try again.";
    msg.classList.add("err");
    btn.disabled = false;
    btn.textContent = "Redeem this piece";
    return;
  }

  if (!data.success) {
    msg.textContent = data.message || "That code isn't valid.";
    msg.classList.add("err");
    btn.disabled = false;
    btn.textContent = "Redeem this piece";
    return;
  }

  document.getElementById("redeemBox").innerHTML = `
    <div class="redeem-success">
      <div class="stamp">ORDER<br>CONFIRMED</div>
      <h3>You claimed it, ${escapeHtml(name.split(" ")[0] || "friend")}.</h3>
      <p>${escapeHtml(product.name)} is yours — order #${data.order_id.slice(0,8)}.<br>We'll email ${escapeHtml(email)} with shipping details.</p>
    </div>
  `;
}

function closeModal() {
  document.getElementById("modalBackdrop").classList.remove("open");
}

// ---------- helpers ----------
function truncate(str, n) { return str.length > n ? str.slice(0, n - 1) + "…" : str; }
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }
function placeholderImg() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='100%25' height='100%25' fill='%23ece0c9'/%3E%3C/svg%3E";
}

document.addEventListener("DOMContentLoaded", loadProducts);
