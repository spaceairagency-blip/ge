# Kindred & Kiln — handmade craft store (redeem-code checkout)

A small e-commerce site where nobody pays with a card. Every product is
"bought" by entering a one-time redeem code, which is validated and burned
atomically in the database so it can never be reused or double-spent.

Codes are **generic**: any unused code works on any product. Products have
no price and orders collect no address — just a name and email.

> Already ran the old version of `supabase.sql`? Run `migration.sql`
> instead of the full schema — it updates your existing tables in place.

## Files

```
index.html      storefront (browse products, redeem a code)
admin.html      admin panel (add products, generate codes, view orders)
css/style.css   shared styling
js/config.js    Supabase URL + anon key (fill this in)
js/main.js      storefront logic
js/admin.js     admin logic
supabase.sql    full database schema, security rules, redeem function
```

## Setup (10 minutes)

1. **Create a Supabase project** at supabase.com (free tier is fine).

2. **Run the schema.** Open the SQL Editor in your Supabase dashboard, paste
   in the entire contents of `supabase.sql`, and run it. This creates the
   `products`, `redeem_codes`, `orders`, `admins` tables, locks them down
   with Row Level Security, and creates the `redeem_code()` function that
   powers checkout.

3. **Create your admin login.** In Supabase: Authentication → Users → Add
   user. Enter an email and password — this is what you'll use to sign into
   `admin.html`.

4. **Whitelist that email as an admin.** Back in the SQL Editor:
   ```sql
   insert into admins (email) values ('you@example.com');
   ```
   Only whitelisted emails can add products, generate codes, or see orders.

5. **Connect the frontend.** In Supabase: Settings → API. Copy the
   **Project URL** and **anon public key** into `js/config.js`:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```
   The anon key is safe to expose — it can only do what your RLS policies
   allow (browse active products, call the redeem function). It can't read
   redeem codes or orders directly.

6. **Open `index.html`** in a browser (or serve the folder with any static
   host — Netlify, Vercel, GitHub Pages, etc.) and you're live.

## Using it

- Go to `admin.html`, sign in, add a product (name, image URL,
  description, category — no price).
- Under **Redeem codes**, generate however many codes you want (e.g. 10).
  Each is a unique code like `MUG-7F2K`. Codes aren't tied to any one
  product — any unused code redeems whatever product the shopper is
  looking at.
- Give a code to a real person however you like — Instagram DM, a paper
  tag at a craft fair, an email.
- They open the store, click a product, type in the code plus their
  name and email, and hit **Redeem this piece**. If the code is valid
  and unused, the order is confirmed instantly and the code is permanently
  burned — nobody else can ever use it, even if they see it.
- The **Orders** tab in admin shows every redemption (product, name,
  email, timestamp), so you know what was claimed and by whom.

## Why it's race-condition safe

The redeem logic lives in a single Postgres function (`redeem_code`) that
locks the code row (`for update`) before checking and marking it used. If
two people submit the same code at the same instant, Postgres serializes
them — one wins, the other gets "already redeemed." This can't be achieved
safely with plain client-side `select` then `update` calls.

## Customizing the look

Colors, type, and the "claim ticket" modal styling all live in
`css/style.css` as CSS variables at the top (`--ink`, `--brass`, `--thread`,
etc.) — change those to reskin the whole site without touching layout code.
