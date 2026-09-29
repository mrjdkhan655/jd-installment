-- ============================================================
-- INSTALLMENT MANAGEMENT SYSTEM — CORE SCHEMA
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
create type app_role as enum ('super_admin', 'admin', 'customer');
create type product_kind as enum ('car', 'gold', 'other');
create type contract_status as enum ('draft', 'active', 'completed', 'extended', 'cancelled');
create type installment_status as enum ('upcoming', 'pending', 'partial', 'paid', 'extended', 'cancelled');
create type payment_method as enum ('cash', 'bank_transfer', 'online', 'other');
create type payment_source as enum ('admin_entry', 'customer_submission');
create type verification_status as enum ('not_required', 'pending', 'approved', 'rejected');
create type penalty_method as enum ('fixed_per_month', 'percent_per_month', 'custom_amount', 'custom_rule');

-- ------------------------------------------------------------
-- USERS (extends auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'customer',
  full_name text not null,
  phone text,
  email text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CUSTOMERS
-- ------------------------------------------------------------
create table public.customers (
  id uuid primary key default uuid_generate_v4(),
  customer_code text not null unique, -- e.g. CUST-00001
  auth_user_id uuid references auth.users(id) on delete set null, -- login identity
  full_name text not null,
  phone text,
  email text,
  government_id text, -- Emirates ID / CNIC / passport
  address text,
  notes text,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_customers_code on public.customers(customer_code);
create index idx_customers_phone on public.customers(phone);
create index idx_customers_govid on public.customers(government_id);

-- ------------------------------------------------------------
-- PRODUCTS / ASSETS (polymorphic: car | gold | other)
-- ------------------------------------------------------------
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  kind product_kind not null,
  name text not null,
  reference_number text, -- generic ref, barcode etc.
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cars (
  product_id uuid primary key references public.products(id) on delete cascade,
  make text, model text, model_year int, color text,
  registration_number text, chassis_number text, engine_number text,
  vehicle_reference text
);
create index idx_cars_reg on public.cars(registration_number);
create index idx_cars_chassis on public.cars(chassis_number);

create table public.gold_assets (
  product_id uuid primary key references public.products(id) on delete cascade,
  description text, gold_type text, purity text, karat text,
  weight_grams numeric(12,3), quantity int default 1,
  serial_number text, barcode text, original_invoice_ref text
);
create index idx_gold_serial on public.gold_assets(serial_number);
create index idx_gold_barcode on public.gold_assets(barcode);

create table public.other_products (
  product_id uuid primary key references public.products(id) on delete cascade,
  description text, quantity int default 1,
  custom_fields jsonb default '{}'::jsonb
);

-- ------------------------------------------------------------
-- CONTRACTS
-- ------------------------------------------------------------
create table public.contracts (
  id uuid primary key default uuid_generate_v4(),
  contract_number text not null unique, -- e.g. CTR-2026-0001
  customer_id uuid not null references public.customers(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  status contract_status not null default 'draft',

  total_amount numeric(14,2) not null,
  down_payment numeric(14,2) not null default 0,

  agreement_date date,
  start_date date not null,
  planned_end_date date,
  actual_end_date date,

  -- penalty configuration
  penalty_enabled boolean not null default false,
  penalty_method penalty_method,
  penalty_value numeric(14,2), -- fixed amount OR percent, per extended month
  penalty_notes text,

  notes text,
  created_by uuid references public.profiles(id),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_contracts_customer on public.contracts(customer_id);
create index idx_contracts_product on public.contracts(product_id);
create index idx_contracts_status on public.contracts(status);

-- ------------------------------------------------------------
-- INSTALLMENT SCHEDULE (flexible, editable line items)
-- ------------------------------------------------------------
create table public.installment_schedules (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  installment_number int not null,
  due_date date not null,
  expected_amount numeric(14,2) not null,
  is_final_balance boolean not null default false, -- "remaining balance" style line
  status installment_status not null default 'upcoming',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contract_id, installment_number)
);
create index idx_schedule_contract on public.installment_schedules(contract_id);
create index idx_schedule_due on public.installment_schedules(due_date);

-- ------------------------------------------------------------
-- PAYMENTS (official ledger entries — only APPROVED ones count)
-- ------------------------------------------------------------
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  installment_id uuid references public.installment_schedules(id) on delete set null,

  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  method payment_method not null default 'cash',
  reference_number text,
  notes text,

  source payment_source not null default 'admin_entry',
  verification_status verification_status not null default 'not_required',
  submitted_by uuid references auth.users(id), -- customer who submitted, if applicable
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  rejection_reason text,

  proof_document_id uuid, -- fk added after documents table
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_payments_contract on public.payments(contract_id);
create index idx_payments_installment on public.payments(installment_id);
create index idx_payments_verification on public.payments(verification_status);

-- helper view: only approved (or admin-entered, which are implicitly official) payments
create view public.official_payments as
  select * from public.payments
  where verification_status in ('not_required', 'approved');

-- ------------------------------------------------------------
-- DOCUMENTS
-- ------------------------------------------------------------
create table public.documents (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references public.customers(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete cascade,
  category text not null, -- agreement | receipt | id_document | vehicle_document | gold_document | invoice | other
  storage_path text not null, -- path inside private bucket
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_documents_customer on public.documents(customer_id);
create index idx_documents_contract on public.documents(contract_id);

alter table public.payments
  add constraint fk_payments_proof_document
  foreign key (proof_document_id) references public.documents(id) on delete set null;

-- ------------------------------------------------------------
-- AGREEMENTS (generated PDFs)
-- ------------------------------------------------------------
create table public.agreements (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  template_type product_kind not null,
  document_id uuid references public.documents(id),
  generated_by uuid references public.profiles(id),
  generated_at timestamptz not null default now(),
  snapshot jsonb not null -- full data used to generate, for reproducibility
);

-- ------------------------------------------------------------
-- BUSINESS SETTINGS
-- ------------------------------------------------------------
create table public.business_settings (
  id int primary key default 1,
  business_name text not null default 'My Business',
  business_address text,
  business_phone text,
  business_email text,
  default_penalty_method penalty_method,
  default_penalty_value numeric(14,2),
  logo_document_id uuid references public.documents(id),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into public.business_settings (id) values (1);

-- ------------------------------------------------------------
-- AUDIT LOG
-- ------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references public.profiles(id),
  action text not null, -- e.g. 'customer.create', 'payment.approve'
  entity_type text not null,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_entity on public.audit_logs(entity_type, entity_id);
create index idx_audit_actor on public.audit_logs(actor_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','customers','products','contracts',
    'installment_schedules','payments','business_settings']
  loop
    execute format('create trigger trg_updated_at before update on public.%I
      for each row execute function public.set_updated_at();', t);
  end loop;
end $$;
