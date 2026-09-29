# Installment Management System

A Next.js + TypeScript + Supabase business application for managing
customers, cars, gold, and other products sold on installment
contracts, with a Super Admin, Admin, and customer self-service portal.

## Honest status

This is a **real, working foundation** — not a mockup — but it is
**Phase 1** of a large system. What's fully built and functional:

- ✅ Complete normalized PostgreSQL schema (`supabase/migrations/`)
- ✅ Row Level Security on every table — customers can only ever see
  their own data, enforced at the database layer, not just in the UI
- ✅ Server-side financial calculations (balances are never computed
  in the browser — see `contract_summary()` and the payment-recalc
  trigger in `0003_storage_and_finance.sql`)
- ✅ Flexible installment engine (`src/lib/installmentEngine.ts`):
  fixed monthly/yearly, "fixed amount + final balloon balance", and
  fully custom per-line schedules
- ✅ Extended-term penalty engine, decoupled from calendar lateness —
  penalties only apply when the contract *itself* runs longer than
  agreed, never for an installment paid a few days late
- ✅ Customer creation with auto-generated login credentials (no
  self-registration)
- ✅ Customer portal: dashboard with per-contract cards + full
  installment ledger detail page, mobile-first
- ✅ Payment submission (customer) → pending → admin approve/reject
  workflow, with the official ledger only updating on approval
- ✅ Auth middleware separating `/dashboard` (staff) from `/portal`
  (customers)
- ✅ Audit log table + writes on the workflows above
- ✅ Private Supabase Storage bucket + policies for documents

## What's intentionally NOT built yet (Phase 2+)

These all depend on the foundation above and are the natural next
slices of work, roughly in priority order:

1. Admin dashboard shell (sidebar nav, KPI cards, recent activity) —
   the DB queries (`contract_summary`, counts, etc.) already exist;
   this is UI assembly
2. Customer/contract creation forms + the installment schedule editor
   UI (the engine exists in `installmentEngine.ts`; needs a form that
   calls `generateSchedule()` and lets the admin edit lines before save)
3. Car / Gold / Other product forms
4. PDF agreement generator (recommend `@react-pdf/renderer`, already
   in `package.json`) with the three templates described in the spec
5. Document upload UI (drag-drop + camera capture on mobile) wired to
   the `documents` table and storage policies already in place
6. Reports module (monthly collections, outstanding, product-wise —
   these are mostly SQL views/RPCs plus a filter UI)
7. Global search across customers/contracts/vehicles/gold serials
8. Settings page for Super Admin (penalty defaults, business info)
9. User management (Super Admin creates Admin accounts)
10. Full audit log viewer UI

I scoped Phase 1 around the parts that are hardest to get right and
most load-bearing for correctness and security (schema, RLS,
financial math, the two-sided payment workflow) rather than the parts
that are comparatively mechanical (more CRUD forms, more pages).

## Setup

1. Create a Supabase project.
2. Run the migrations in order against it:
   ```
   supabase/migrations/0001_schema.sql
   supabase/migrations/0002_rls.sql
   supabase/migrations/0003_storage_and_finance.sql
   ```
   (via `supabase db push` if you link the CLI, or paste them into the
   SQL editor in order).
3. Copy `.env.example` to `.env.local` and fill in your project URL,
   anon key, and service role key (Project Settings → API).
4. Generate real types: `npx supabase gen types typescript --linked > src/types/database.ts`
   (replaces the `any` placeholder currently in that file).
5. Manually create your first Super Admin: sign up a user via
   Supabase Auth, then insert a row into `profiles` with
   `role = 'super_admin'` for that user's `id`.
6. `npm install && npm run dev`

## Deployment

This is standard Next.js + Supabase, so it deploys cleanly to Vercel,
or to Cloudflare via `@cloudflare/next-on-pages` / Cloudflare Pages'
Next.js adapter if you specifically want Cloudflare — either works,
Cloudflare needs one extra adapter step Vercel doesn't. I didn't wire
a specific deploy config here since that's a one-time choice best made
with your actual account/domain in front of you.

## Architecture notes for whoever continues this

- `src/lib/supabase/client.ts` — browser client (RLS-scoped)
- `src/lib/supabase/server.ts` — server client (RLS-scoped) +
  `createServiceRoleClient()` for the rare operations that legitimately
  need to bypass RLS (creating a customer's auth login). Never import
  the service-role client into anything that ships to the browser.
- `src/lib/actions/*.ts` — Server Actions; this is where all writes
  should happen, validated with `zod`, authorized explicitly (don't
  rely on RLS alone for the "is this user staff" check — check it in
  the action too, RLS is the last line of defense, not the only one)
- `src/lib/installmentEngine.ts` — pure functions, no I/O, fully
  unit-testable in isolation
- Route groups: `(admin)/dashboard/*` for staff, `(customer)/portal/*`
  for customers, split by `middleware.ts`

## Suggested next session

Tell me which Phase 2 item to build next — I'd suggest starting with
#2 (contract creation + schedule editor), since it's the piece that
makes the installment engine actually usable end-to-end.
