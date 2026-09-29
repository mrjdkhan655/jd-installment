-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.cars enable row level security;
alter table public.gold_assets enable row level security;
alter table public.other_products enable row level security;
alter table public.contracts enable row level security;
alter table public.installment_schedules enable row level security;
alter table public.payments enable row level security;
alter table public.documents enable row level security;
alter table public.agreements enable row level security;
alter table public.business_settings enable row level security;
alter table public.audit_logs enable row level security;

-- ------------------------------------------------------------
-- Helper functions (SECURITY DEFINER, read profiles/customers
-- without recursive RLS)
-- ------------------------------------------------------------
create or replace function public.current_role_is(_roles app_role[])
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = any(_roles) and p.is_active
  );
$$;

create or replace function public.is_staff() returns boolean
language sql security definer stable as $$
  select public.current_role_is(array['super_admin','admin']::app_role[]);
$$;

create or replace function public.is_super_admin() returns boolean
language sql security definer stable as $$
  select public.current_role_is(array['super_admin']::app_role[]);
$$;

-- maps the logged-in customer auth user -> their customers.id
create or replace function public.my_customer_ids() returns setof uuid
language sql security definer stable as $$
  select id from public.customers where auth_user_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- PROFILES: staff can see all staff profiles; users see themselves
-- ------------------------------------------------------------
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_staff());
create policy profiles_insert_super on public.profiles for insert
  with check (public.is_super_admin());
create policy profiles_update_super on public.profiles for update
  using (public.is_super_admin() or id = auth.uid());

-- ------------------------------------------------------------
-- CUSTOMERS: staff full access; customer sees only their own row
-- ------------------------------------------------------------
create policy customers_staff_all on public.customers for all
  using (public.is_staff()) with check (public.is_staff());
create policy customers_self_select on public.customers for select
  using (auth_user_id = auth.uid());

-- ------------------------------------------------------------
-- PRODUCTS / CARS / GOLD / OTHER: staff manage; customers read only
-- products tied to their own contracts
-- ------------------------------------------------------------
create policy products_staff_all on public.products for all
  using (public.is_staff()) with check (public.is_staff());
create policy products_customer_select on public.products for select
  using (exists (
    select 1 from public.contracts c
    where c.product_id = products.id and c.customer_id in (select public.my_customer_ids())
  ));

create policy cars_staff_all on public.cars for all
  using (public.is_staff()) with check (public.is_staff());
create policy cars_customer_select on public.cars for select
  using (exists (
    select 1 from public.contracts c
    where c.product_id = cars.product_id and c.customer_id in (select public.my_customer_ids())
  ));

create policy gold_staff_all on public.gold_assets for all
  using (public.is_staff()) with check (public.is_staff());
create policy gold_customer_select on public.gold_assets for select
  using (exists (
    select 1 from public.contracts c
    where c.product_id = gold_assets.product_id and c.customer_id in (select public.my_customer_ids())
  ));

create policy other_staff_all on public.other_products for all
  using (public.is_staff()) with check (public.is_staff());
create policy other_customer_select on public.other_products for select
  using (exists (
    select 1 from public.contracts c
    where c.product_id = other_products.product_id and c.customer_id in (select public.my_customer_ids())
  ));

-- ------------------------------------------------------------
-- CONTRACTS: staff full; customer reads only their own contracts
-- ------------------------------------------------------------
create policy contracts_staff_all on public.contracts for all
  using (public.is_staff()) with check (public.is_staff());
create policy contracts_customer_select on public.contracts for select
  using (customer_id in (select public.my_customer_ids()));

-- ------------------------------------------------------------
-- INSTALLMENT SCHEDULES
-- ------------------------------------------------------------
create policy schedules_staff_all on public.installment_schedules for all
  using (public.is_staff()) with check (public.is_staff());
create policy schedules_customer_select on public.installment_schedules for select
  using (exists (
    select 1 from public.contracts c
    where c.id = installment_schedules.contract_id
      and c.customer_id in (select public.my_customer_ids())
  ));

-- ------------------------------------------------------------
-- PAYMENTS
-- staff: full access.
-- customer: can SELECT their own contract's payments (so they can see
--   pending/approved/rejected history), and can INSERT a new payment
--   row only as a 'customer_submission' with verification_status='pending'
--   for their own contract. They can never set verification_status
--   to approved, nor update/delete existing rows.
-- ------------------------------------------------------------
create policy payments_staff_all on public.payments for all
  using (public.is_staff()) with check (public.is_staff());

create policy payments_customer_select on public.payments for select
  using (exists (
    select 1 from public.contracts c
    where c.id = payments.contract_id and c.customer_id in (select public.my_customer_ids())
  ));

create policy payments_customer_insert on public.payments for insert
  with check (
    source = 'customer_submission'
    and verification_status = 'pending'
    and submitted_by = auth.uid()
    and exists (
      select 1 from public.contracts c
      where c.id = payments.contract_id and c.customer_id in (select public.my_customer_ids())
    )
  );

-- ------------------------------------------------------------
-- DOCUMENTS
-- staff: full. customer: select/insert only within their own scope.
-- ------------------------------------------------------------
create policy documents_staff_all on public.documents for all
  using (public.is_staff()) with check (public.is_staff());

create policy documents_customer_select on public.documents for select
  using (
    customer_id in (select public.my_customer_ids())
    or contract_id in (
      select id from public.contracts where customer_id in (select public.my_customer_ids())
    )
  );

create policy documents_customer_insert on public.documents for insert
  with check (
    uploaded_by = auth.uid()
    and (
      customer_id in (select public.my_customer_ids())
      or contract_id in (
        select id from public.contracts where customer_id in (select public.my_customer_ids())
      )
    )
  );

-- ------------------------------------------------------------
-- AGREEMENTS: staff manage; customer can view agreements tied to
-- their own contracts
-- ------------------------------------------------------------
create policy agreements_staff_all on public.agreements for all
  using (public.is_staff()) with check (public.is_staff());
create policy agreements_customer_select on public.agreements for select
  using (exists (
    select 1 from public.contracts c
    where c.id = agreements.contract_id and c.customer_id in (select public.my_customer_ids())
  ));

-- ------------------------------------------------------------
-- BUSINESS SETTINGS: only super_admin can write; staff can read
-- ------------------------------------------------------------
create policy settings_staff_select on public.business_settings for select
  using (public.is_staff());
create policy settings_super_write on public.business_settings for update
  using (public.is_super_admin());

-- ------------------------------------------------------------
-- AUDIT LOGS: staff read-only via app (writes happen server-side
-- with service role, bypassing RLS)
-- ------------------------------------------------------------
create policy audit_staff_select on public.audit_logs for select
  using (public.is_staff());
