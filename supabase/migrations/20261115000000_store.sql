create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to anon, authenticated;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  category text not null check (char_length(category) between 1 and 80),
  description text not null default '',
  price numeric(12, 2) not null default 0,
  asset_path text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  user_id uuid not null references auth.users (id) on delete restrict,
  total_amount numeric(12, 2) not null check (total_amount > 0),
  currency text not null default 'LKR' check (currency = 'LKR'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'failed', 'chargedback')),
  payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_price_nonnegative'
  ) then
    alter table public.products
      add constraint products_price_nonnegative check (price >= 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_total_positive'
  ) then
    alter table public.orders
      add constraint orders_total_positive check (total_amount > 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_items'::regclass
      and conname = 'order_items_unit_price_positive'
  ) then
    alter table public.order_items
      add constraint order_items_unit_price_positive check (unit_price > 0) not valid;
  end if;
end
$$;

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create unique index if not exists order_items_order_product_idx
  on public.order_items (order_id, product_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  unit_price numeric(12, 2) not null check (unit_price > 0),
  asset_path text not null,
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);

alter table public.admins enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Admins can read admin assignments"
  on public.admins for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_store_admin()));

create policy "Anyone can view active products"
  on public.products for select to anon, authenticated
  using (active or (select public.is_store_admin()));

create policy "Admins can insert products"
  on public.products for insert to authenticated
  with check ((select public.is_store_admin()));

create policy "Admins can update products"
  on public.products for update to authenticated
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));

create policy "Admins can delete products"
  on public.products for delete to authenticated
  using ((select public.is_store_admin()));

create policy "Customers and admins can read orders"
  on public.orders for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_store_admin())
  );

create policy "Customers and admins can read order items"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and (
          orders.user_id = (select auth.uid())
          or (select public.is_store_admin())
        )
    )
  );

grant usage on schema public to anon, authenticated, service_role;
grant select on public.products to anon, authenticated, service_role;
grant insert, update, delete on public.products to authenticated;
grant select on public.orders, public.order_items to authenticated;
grant select on public.admins to authenticated;
grant all on public.orders, public.order_items to service_role;

insert into public.products (title, category, description, sort_order)
select seed.title, seed.category, seed.description, seed.sort_order
from (values
  ('Premium AI Panel', 'PC External', 'A PC performance utility from the Viper Hex collection. Details and compatibility are available from the store team.', 1),
  ('Ultimate Aimbot', 'PC External', 'A PC performance utility from the Viper Hex collection. Details and compatibility are available from the store team.', 2),
  ('Spideyhex External', 'PC External', 'A PC performance utility from the Viper Hex collection. Details and compatibility are available from the store team.', 3),
  ('AI Aimbot', 'PC External', 'A PC performance utility from the Viper Hex collection. Details and compatibility are available from the store team.', 4),
  ('BR Mods', 'PC Internal', 'A PC performance utility from the Viper Hex collection. Details and compatibility are available from the store team.', 5),
  ('Spidey Internal Premium', 'PC Internal', 'A PC performance utility from the Viper Hex collection. Details and compatibility are available from the store team.', 6),
  ('Internal Premium Pro', 'PC Internal', 'A PC performance utility from the Viper Hex collection. Details and compatibility are available from the store team.', 7),
  ('Bypass', 'PC Bypass', 'A PC performance utility from the Viper Hex collection. Details and compatibility are available from the store team.', 8),
  ('Emote Panel', 'Emote Panel', 'A PC performance utility from the Viper Hex collection. Details and compatibility are available from the store team.', 9)
) as seed(title, category, description, sort_order)
where not exists (
  select 1 from public.products existing
  where existing.title = seed.title
    and coalesce(existing.category, '') = seed.category
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-files',
  'product-files',
  false,
  524288000,
  array['application/octet-stream', 'application/zip', 'application/x-zip-compressed', 'application/x-msdownload', 'application/vnd.microsoft.portable-executable', 'application/x-7z-compressed', 'application/x-rar-compressed']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can upload product files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-files'
    and (select public.is_store_admin())
  );

create policy "Admins can view product files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'product-files'
    and (select public.is_store_admin())
  );

create policy "Admins can update product files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-files'
    and (select public.is_store_admin())
  )
  with check (
    bucket_id = 'product-files'
    and (select public.is_store_admin())
  );

create policy "Admins can delete product files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-files'
    and (select public.is_store_admin())
  );
