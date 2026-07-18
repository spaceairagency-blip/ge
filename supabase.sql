-- =========================================================
-- HANDMADE CRAFT STORE — Supabase schema
-- Run this whole file once in Supabase SQL Editor.
-- Codes are generic: ANY unused code redeems ANY product.
-- No prices, no addresses — just name + email.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------- TABLES ----------

create table if not exists products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  image_url    text,
  category     text default 'General',
  is_active    boolean default true,
  created_at   timestamptz default now()
);

-- Generic redeem codes — NOT tied to a specific product.
-- Whoever redeems one can claim whatever product they were looking at.
create table if not exists redeem_codes (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  is_used        boolean default false,
  used_by_name   text,
  used_by_email  text,
  used_at        timestamptz,
  created_at     timestamptz default now()
);

create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid references products(id),
  redeem_code_id  uuid references redeem_codes(id),
  buyer_name      text not null,
  buyer_email     text,
  status          text default 'confirmed',
  created_at      timestamptz default now()
);

-- Whitelist of admin emails (must match a Supabase Auth user's email)
create table if not exists admins (
  email text primary key
);

create index if not exists idx_orders_product on orders(product_id);

-- ---------- ADMIN CHECK (non-recursive) ----------
-- security definer lets this bypass RLS internally, so checking "is this
-- caller an admin" never triggers RLS recursion on the admins table itself.

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from admins where email = auth.jwt() ->> 'email');
$$;

-- ---------- ROW LEVEL SECURITY ----------

alter table products      enable row level security;
alter table redeem_codes  enable row level security;
alter table orders        enable row level security;
alter table admins        enable row level security;

create policy "public_read_active_products"
  on products for select
  using (is_active = true);

create policy "admins_manage_products"
  on products for all
  using (is_admin())
  with check (is_admin());

-- Nobody can browse redeem codes directly (would let people guess/see them).
-- Only admins can manage them; shoppers redeem through redeem_code() below.
create policy "admins_manage_redeem_codes"
  on redeem_codes for all
  using (is_admin())
  with check (is_admin());

create policy "admins_view_orders"
  on orders for select
  using (is_admin());

create policy "admins_view_admins"
  on admins for select
  using (email = auth.jwt() ->> 'email');

-- ---------- REDEEM FUNCTION ----------
-- One code, any product. "for update" locks the code row so two people
-- redeeming the same code at the same instant can't both win.

create or replace function redeem_code(
  p_code        text,
  p_product_id  uuid,
  p_buyer_name  text,
  p_buyer_email text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    redeem_codes%rowtype;
  v_product products%rowtype;
  v_order_id uuid;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return json_build_object('success', false, 'message', 'Please enter a code.');
  end if;

  select * into v_product from products where id = p_product_id and is_active = true;
  if not found then
    return json_build_object('success', false, 'message', 'That product is not available.');
  end if;

  select * into v_code
  from redeem_codes
  where upper(code) = upper(trim(p_code))
  for update;

  if not found then
    return json_build_object('success', false, 'message', 'That code doesn''t exist.');
  end if;

  if v_code.is_used then
    return json_build_object('success', false, 'message', 'This code has already been redeemed.');
  end if;

  update redeem_codes
  set is_used = true,
      used_by_name = p_buyer_name,
      used_by_email = p_buyer_email,
      used_at = now()
  where id = v_code.id;

  insert into orders (product_id, redeem_code_id, buyer_name, buyer_email)
  values (p_product_id, v_code.id, p_buyer_name, p_buyer_email)
  returning id into v_order_id;

  return json_build_object(
    'success', true,
    'message', 'Redeemed! Your order is confirmed.',
    'order_id', v_order_id,
    'product_name', v_product.name
  );
end;
$$;

grant execute on function redeem_code(text, uuid, text, text) to anon, authenticated;

-- ---------- GETTING STARTED ----------
-- 1. Run this file in Supabase SQL editor.
-- 2. Create an admin login: Authentication > Users > Add user (email + password).
-- 3. Whitelist that email:
--      insert into admins (email) values ('you@example.com');
-- 4. Add products and generate codes from admin.html. Any code redeems any product.
