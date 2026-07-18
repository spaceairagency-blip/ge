-- =========================================================
-- MIGRATION: run this if you already executed the original supabase.sql
-- Changes: codes become generic (any code, any product), drops price
-- and address everywhere. Safe to run once.
-- =========================================================

-- Codes are no longer tied to one product
alter table redeem_codes drop constraint if exists redeem_codes_product_id_fkey;
alter table redeem_codes drop column if exists product_id;
alter table redeem_codes drop column if exists used_by_address;

-- No price
alter table products drop column if exists price;

-- No address
alter table orders drop column if exists buyer_address;

-- Non-recursive admin check (fixes "infinite recursion detected in policy
-- for relation admins" if you hit that error)
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from admins where email = auth.jwt() ->> 'email');
$$;

drop policy if exists "admins_manage_products" on products;
create policy "admins_manage_products" on products for all
  using (is_admin()) with check (is_admin());

drop policy if exists "admins_manage_redeem_codes" on redeem_codes;
create policy "admins_manage_redeem_codes" on redeem_codes for all
  using (is_admin()) with check (is_admin());

drop policy if exists "admins_view_orders" on orders;
create policy "admins_view_orders" on orders for select
  using (is_admin());

drop policy if exists "admins_view_admins" on admins;
create policy "admins_view_admins" on admins for select
  using (email = auth.jwt() ->> 'email');

-- Replace the redeem function: old signature (text,text,text,text) is gone,
-- new one takes a product_id since codes no longer carry one.
drop function if exists redeem_code(text, text, text, text);

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
