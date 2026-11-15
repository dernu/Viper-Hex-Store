# Viper Hex Store

Black-and-purple PC performance app storefront with Supabase authentication, customer order history, private product-file delivery, admin catalog management, and PayHere checkout.

The original logo image was not present in the workspace, so the storefront currently uses a circular VH monogram placeholder.

## Local setup

1. Install Node.js 20.19+ and run `npm install`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (create it from `.env.example` if needed). Never put a service-role key or PayHere merchant secret in a `VITE_` variable.
3. In the Supabase SQL Editor, run `supabase/migrations/20261115000000_store.sql`.
4. Configure Auth email confirmation and the site's production redirect URL in Supabase.
5. Run `npm run dev`. Use `npm run build` to create the production site in `dist`.

## Admin access

Create both admin accounts through the store's sign-up form. After each account is confirmed, use the Supabase SQL Editor to assign admin access by account email:

```sql
insert into public.admins (user_id)
select id from auth.users
where email in ('FIRST_ADMIN_EMAIL', 'SECOND_ADMIN_EMAIL')
on conflict (user_id) do nothing;
```

Replace both example email values before running the query. Only these database-assigned accounts can manage products, prices, and private product files.

## PayHere and Edge Functions

Deploy the three functions in `supabase/functions` using the Supabase CLI after linking the project. Set these function secrets in Supabase; do not commit them:

- `PAYHERE_MERCHANT_ID`
- `PAYHERE_MERCHANT_SECRET`
- `PAYHERE_SANDBOX` (`true` while testing; `false` for live payments)
- `SITE_URL` (the exact public HTTPS site origin)

The Supabase platform provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Verify these are available after deployment.

Checkout is unavailable until each product has an active price and a secure download file. Checkout creates LKR orders from server-side catalog prices. PayHere’s verified notification—not the customer’s return redirect—marks an order paid. Download links are private and expire after five minutes.

## Before public launch

- Replace product descriptions with accurate, supportable details and set prices in the admin panel.
- Complete the live PayHere merchant onboarding and domain approval; test checkout and notifications in sandbox first.
- Confirm PayHere's merchant settlement settings point to the intended business bank account; this store does not collect or expose bank credentials.
- Add and verify both admin accounts, production Auth redirect URLs, and Edge Function secrets.
- Publish `dist` to an HTTPS host, set `SITE_URL` to that exact origin, and register it with PayHere.
- Add the business's terms, privacy, refund, and support/contact information before accepting public orders.

No Supabase project changes or public deployment are performed by the local build.
