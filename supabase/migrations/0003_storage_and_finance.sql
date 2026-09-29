-- ============================================================
-- STORAGE: private bucket + policies
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Path convention: documents/{customer_id}/{contract_id}/{filename}
-- Staff: full access. Customers: only inside a folder matching one
-- of their own customer_id values.
create policy storage_staff_all on storage.objects for all
  using (bucket_id = 'documents' and public.is_staff())
  with check (bucket_id = 'documents' and public.is_staff());

create policy storage_customer_select on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select public.my_customer_ids())
  );

create policy storage_customer_insert on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select public.my_customer_ids())
  );

-- ============================================================
-- FINANCIAL CALCULATIONS — always server-side, never trust the client
-- ============================================================

-- Total approved/official payments for a contract
create or replace function public.contract_total_paid(_contract_id uuid)
returns numeric language sql stable as $$
  select coalesce(sum(amount), 0) from public.official_payments
  where contract_id = _contract_id;
$$;

-- Full financial summary for one contract
create or replace function public.contract_summary(_contract_id uuid)
returns table (
  total_amount numeric,
  total_paid numeric,
  outstanding numeric,
  pending_submissions numeric
) language sql stable as $$
  select
    c.total_amount,
    public.contract_total_paid(c.id) as total_paid,
    c.total_amount - public.contract_total_paid(c.id) as outstanding,
    coalesce((select sum(p.amount) from public.payments p
      where p.contract_id = c.id and p.verification_status = 'pending'), 0) as pending_submissions
  from public.contracts c where c.id = _contract_id;
$$;

-- Recalculate a single installment's paid/remaining/status from
-- official payments linked to it. Call after any payment
-- insert/update/delete (via trigger below).
create or replace function public.recalc_installment(_installment_id uuid)
returns void language plpgsql as $$
declare
  _expected numeric;
  _paid numeric;
  _due date;
begin
  select expected_amount, due_date into _expected, _due
  from public.installment_schedules where id = _installment_id;

  select coalesce(sum(amount), 0) into _paid
  from public.official_payments where installment_id = _installment_id;

  update public.installment_schedules
  set status = case
      when _paid <= 0 then (case when _due < current_date then 'pending' else 'upcoming' end)
      when _paid < _expected then 'partial'
      else 'paid'
    end::installment_status
  where id = _installment_id;
end; $$;

create or replace function public.trg_payments_recalc()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'DELETE') then
    if old.installment_id is not null then
      perform public.recalc_installment(old.installment_id);
    end if;
    return old;
  else
    if new.installment_id is not null then
      perform public.recalc_installment(new.installment_id);
    end if;
    if TG_OP = 'UPDATE' and old.installment_id is distinct from new.installment_id
       and old.installment_id is not null then
      perform public.recalc_installment(old.installment_id);
    end if;
    return new;
  end if;
end; $$;

create trigger trg_payments_recalc_iud
after insert or update or delete on public.payments
for each row execute function public.trg_payments_recalc();

-- Auto-complete contract when all installments are paid
create or replace function public.trg_check_contract_completion()
returns trigger language plpgsql as $$
declare
  _contract_id uuid;
  _remaining int;
begin
  select contract_id into _contract_id from public.installment_schedules where id = new.id;
  select count(*) into _remaining from public.installment_schedules
    where contract_id = _contract_id and status not in ('paid','cancelled');
  if _remaining = 0 then
    update public.contracts set status = 'completed', actual_end_date = current_date
      where id = _contract_id and status in ('active','extended');
  end if;
  return new;
end; $$;

create trigger trg_installment_completion
after update of status on public.installment_schedules
for each row when (new.status = 'paid')
execute function public.trg_check_contract_completion();
