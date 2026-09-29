import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Coins,
  CheckCircle2,
  Wallet,
  Calendar,
  Gem,
  Car,
  ExternalLink,
  Check,
} from "lucide-react";
import { PortalHeaderActions } from "@/components/portal/PortalHeaderActions";

export const metadata = { title: "Customer Portal — Muhammad Wahab" };

const fmt = (n: number) =>
  "AED\u00A0" + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
    case "not_required":
      return {
        label: "VERIFIED & CREDITED",
        color: "#166534",
        bg: "#F0FDF4",
        border: "#BBF7D0",
      };
    case "pending":
      return {
        label: "UNDER AUDIT",
        color: "#1D4ED8",
        bg: "#EFF6FF",
        border: "#BFDBFE",
      };
    case "rejected":
      return {
        label: "REJECTED",
        color: "#B91C1C",
        bg: "#FEF2F2",
        border: "#FECACA",
      };
    default:
      return {
        label: status.toUpperCase(),
        color: "#4B5563",
        bg: "#F3F4F6",
        border: "#E5E7EB",
      };
  }
}

function renderAssetIcon(kind: string | undefined, name: string | undefined) {
  const isGold = kind === "gold" || name?.toLowerCase().includes("gold");
  const isCar = kind === "car" || name?.toLowerCase().includes("car") || name?.toLowerCase().includes("auto");
  if (isGold) {
    return (
      <div className="w-12 h-12 rounded-xl bg-[#FDF6EC] border border-[#F5E8D0] flex items-center justify-center text-[#B89047] flex-shrink-0 shadow-sm">
        <Gem className="w-6 h-6" />
      </div>
    );
  }
  if (isCar) {
    return (
      <div className="w-12 h-12 rounded-xl bg-[#EFF4FA] border border-[#D1DDF0] flex items-center justify-center text-[#1E40AF] flex-shrink-0 shadow-sm">
        <Car className="w-6 h-6" />
      </div>
    );
  }
  return (
    <div className="w-12 h-12 rounded-xl bg-[#F5F4EF] border border-[#EAE8E2] flex items-center justify-center text-[#64748B] flex-shrink-0 shadow-sm">
      <Wallet className="w-6 h-6" />
    </div>
  );
}

export default async function PortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: customer } = await supabase
    .from("customers")
    .select("id, customer_code, full_name, phone")
    .eq("auth_user_id", user.id)
    .single();
  if (!customer) redirect("/login");

  // Fetch customer contracts
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, contract_number, status, total_amount, down_payment, start_date, products(name, kind)")
    .eq("customer_id", customer.id)
    .in("status", ["active", "draft", "extended", "completed"])
    .order("created_at", { ascending: false });

  const contractIds = (contracts ?? []).map((c) => c.id);

  // Fetch upcoming installments for each contract
  const { data: schedules } = contractIds.length > 0
    ? await supabase
        .from("installment_schedules")
        .select("id, contract_id, installment_number, due_date, expected_amount, status")
        .in("contract_id", contractIds)
        .in("status", ["upcoming", "pending", "partial"])
        .order("due_date", { ascending: true })
    : { data: [] };

  // Fetch ALL payments submitted by or credited to this customer's contracts
  const { data: allPayments } = contractIds.length > 0
    ? await supabase
        .from("payments")
        .select(`
          id,
          amount,
          payment_date,
          method,
          reference_number,
          notes,
          verification_status,
          created_at,
          rejection_reason,
          proof_document_id,
          contract_id,
          contracts (
            contract_number,
            products (
              name,
              kind
            )
          ),
          documents:documents!fk_payments_proof_document (
            id,
            file_name
          )
        `)
        .in("contract_id", contractIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const officialPayments = (allPayments ?? []).filter(
    (p) => p.verification_status === "not_required" || p.verification_status === "approved"
  );
  const pendingPayments = (allPayments ?? []).filter((p) => p.verification_status === "pending");

  const totalAgreed = contracts?.reduce((s, c) => s + Number(c.total_amount), 0) ?? 0;
  const totalDownPayment = contracts?.reduce((s, c) => s + (Number(c.down_payment) || 0), 0) ?? 0;
  
  // Calculate total paid across all contracts, crediting advance down payment if not already in payments
  let totalPaid = 0;
  (contracts ?? []).forEach((c) => {
    const cPayments = officialPayments.filter((p) => p.contract_id === c.id);
    const rawC = cPayments.reduce((s, p) => s + Number(p.amount), 0);
    const hasDpInPayments = cPayments.some(
      (p) => p.reference_number === "ADVANCE-DOWNPAYMENT" || (p.notes && p.notes.toLowerCase().includes("down payment"))
    );
    const cDp = Number(c.down_payment) || 0;
    totalPaid += rawC + (hasDpInPayments ? 0 : cDp);
  });

  const outstanding  = Math.max(0, totalAgreed - totalPaid);
  const pendingTotal = pendingPayments.reduce((s, p) => s + Number(p.amount), 0);

  // High-precision percentage calculations (supports fractional percentages like 0.3%)
  const paidFraction = totalAgreed > 0 ? (totalPaid / totalAgreed) * 100 : 0;
  const remainingFraction = Math.max(0, 100 - paidFraction);

  const paidPctFormatted = paidFraction === 0 ? "0%" : paidFraction < 1 ? `${paidFraction.toFixed(1)}%` : Number.isInteger(paidFraction) ? `${paidFraction}%` : `${paidFraction.toFixed(1)}%`;
  const remainingPctFormatted = remainingFraction === 100 ? "100%" : remainingFraction > 99 ? `${remainingFraction.toFixed(1)}%` : Number.isInteger(remainingFraction) ? `${remainingFraction}%` : `${remainingFraction.toFixed(1)}%`;

  // Visual line width (shows at least 2% active indicator once payment is received)
  const progressLineWidth = totalPaid > 0 ? Math.max(2, Math.min(100, paidFraction)) : 0;

  // Group next due per contract
  const nextDueMap = new Map<string, any>();
  (schedules ?? []).forEach((s) => {
    if (!nextDueMap.has(s.contract_id)) {
      nextDueMap.set(s.contract_id, s);
    }
  });

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-16 text-[#0B1B3D]">
      {/* Sticky Top Header with User Context & Sign Out */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#EAE7E0] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt="Muhammad Wahab"
              className="h-9 w-auto max-w-[140px] object-contain"
              loading="eager"
              decoding="async"
            />
            <div className="hidden sm:block">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#0B1B3D]">
                Muhammad Wahab
              </span>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-8 h-full">
            <Link
              href="/portal"
              className="h-full flex items-center text-sm font-semibold text-[#0B1B3D] border-b-2 border-[#C5A880] pt-0.5"
            >
              Overview
            </Link>
            <a
              href="#agreements"
              className="h-full flex items-center text-sm font-medium text-[#64748B] hover:text-[#0B1B3D] transition-colors"
            >
              Installments
            </a>
            <a
              href="#payments"
              className="h-full flex items-center text-sm font-medium text-[#64748B] hover:text-[#0B1B3D] transition-colors"
            >
              Payments
            </a>
            <Link
              href="/portal/documents"
              className="h-full flex items-center text-sm font-medium text-[#64748B] hover:text-[#0B1B3D] transition-colors"
            >
              Documents
            </Link>
          </nav>

          {/* Right: User / Password / Sign Out */}
          <PortalHeaderActions customer={customer} />
        </div>
      </header>

      {/* Main Responsive Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        
        {/* Page Title & Subtitle */}
        <div className="mb-6">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0B1B3D] tracking-tight">
            Financial Overview
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Track your payments, view installment details and manage your agreement.
          </p>
        </div>

        {/* 4-Metric Grid (Matches Screenshot) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Card 1: Total Agreed */}
          <div className="bg-white border border-[#EAE7E0] rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#FDF6EC] border border-[#F5E8D0] flex items-center justify-center text-[#B89047] flex-shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-medium text-[#64748B]">Total Agreed</span>
                <div className="text-lg sm:text-xl font-bold text-[#0B1B3D] tabular-nums mt-0.5">
                  {fmt(totalAgreed)}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Paid (Verified) */}
          <div className="bg-white border border-[#EAE7E0] rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center text-[#16A34A] flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-medium text-[#64748B]">Paid (Verified)</span>
                <div className="text-lg sm:text-xl font-bold text-[#166534] tabular-nums mt-0.5">
                  {fmt(totalPaid)}
                </div>
              </div>
            </div>
            {totalDownPayment > 0 && (
              <div className="text-[11px] text-[#166534] font-medium mt-2 pt-2 border-t border-[#F0FDF4]">
                Includes {fmt(totalDownPayment)} Advance
              </div>
            )}
          </div>

          {/* Card 3: Remaining Balance */}
          <div className="bg-white border border-[#EAE7E0] rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#EFF4FA] border border-[#D1DDF0] flex items-center justify-center text-[#1E40AF] flex-shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-medium text-[#64748B]">Remaining Balance</span>
                <div className="text-lg sm:text-xl font-bold text-[#0F4C3A] tabular-nums mt-0.5">
                  {fmt(outstanding)}
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Payment Progress */}
          <div className="bg-white border border-[#EAE7E0] rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#64748B]">Payment Progress</span>
              <span className="text-xs font-bold text-[#0F4C3A]">
                {remainingPctFormatted} remaining ({paidPctFormatted} paid)
              </span>
            </div>
            <div className="mt-3">
              <div className="h-2 w-full bg-[#EAE8E2] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0F4C3A] rounded-full transition-all duration-500"
                  style={{ width: `${progressLineWidth}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pending Verification Notice (If Any) */}
        {pendingPayments && pendingPayments.length > 0 && (
          <div className="mb-8 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#BFDBFE] text-[#1D4ED8] flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
              !
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#1D4ED8] m-0">
                Pending Verification ({fmt(pendingTotal)})
              </p>
              <p className="text-xs text-[#1E3A8A] mt-1 leading-relaxed">
                You have {pendingPayments.length} payment submission undergoing audit by our accounts team. Once approved, the amount will be immediately deducted from your remaining balance.
              </p>
            </div>
          </div>
        )}

        {/* Section: Your Installment Agreements */}
        <section id="agreements" className="mb-10">
          <h2 className="font-serif text-xl font-bold text-[#0B1B3D] mb-4">
            Your Installment Agreements
          </h2>

          {!contracts || contracts.length === 0 ? (
            <div className="bg-white border border-[#EAE7E0] rounded-xl p-8 text-center text-[#64748B] text-xs">
              No active installment agreements on record.
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {contracts.map((c) => {
                const product = c.products as unknown as { name: string; kind: string } | null;
                const nextDue = nextDueMap.get(c.id);

                const cDp = Number(c.down_payment) || 0;
                const cPayments = officialPayments.filter((p) => p.contract_id === c.id);
                const cRawPaid = cPayments.reduce((sum, p) => sum + p.amount, 0);
                const hasDp = cPayments.some(
                  (p) => p.reference_number === "ADVANCE-DOWNPAYMENT" || (p.notes && p.notes.toLowerCase().includes("down payment"))
                );
                const cPaid = cRawPaid + (hasDp ? 0 : cDp);
                const cRemaining = Math.max(0, Number(c.total_amount) - cPaid);

                const cPaidFraction = Number(c.total_amount) > 0 ? (cPaid / Number(c.total_amount)) * 100 : 0;
                const cRemainingFraction = Math.max(0, 100 - cPaidFraction);
                const cPaidPct = cPaidFraction === 0 ? "0%" : cPaidFraction < 1 ? `${cPaidFraction.toFixed(1)}%` : Number.isInteger(cPaidFraction) ? `${cPaidFraction}%` : `${cPaidFraction.toFixed(1)}%`;
                const cRemainingPct = cRemainingFraction === 100 ? "100%" : cRemainingFraction > 99 ? `${cRemainingFraction.toFixed(1)}%` : Number.isInteger(cRemainingFraction) ? `${cRemainingFraction}%` : `${cRemainingFraction.toFixed(1)}%`;
                const cProgressLineWidth = cPaid > 0 ? Math.max(2, Math.min(100, cPaidFraction)) : 0;

                return (
                  <div
                    key={c.id}
                    className="bg-white border border-[#EAE7E0] rounded-xl p-5 sm:p-6 shadow-sm"
                  >
                    {/* Top Row: Asset Preview & Status */}
                    <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-[#F5F4EF]">
                      <div className="flex items-center gap-3.5">
                        {renderAssetIcon(product?.kind, product?.name)}
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-[#0B1B3D]">
                            {product?.name || "Financed Asset"}
                          </h3>
                          <p className="text-xs text-[#64748B] mt-0.5">
                            Contract:{" "}
                            <span className="font-mono font-bold text-[#0F4C3A]">
                              #{c.contract_number}
                            </span>
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                        {c.status.toUpperCase()}
                      </span>
                    </div>

                    {/* 3-Column Stats Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#F0EFEA] py-4 my-2 text-left sm:text-center">
                      <div className="py-2 sm:py-0 sm:px-4">
                        <span className="text-xs font-medium text-[#64748B] block">Total Agreed</span>
                        <span className="text-base font-bold text-[#0B1B3D] tabular-nums block mt-1">
                          {fmt(c.total_amount)}
                        </span>
                      </div>
                      <div className="py-2 sm:py-0 sm:px-4">
                        <span className="text-xs font-medium text-[#64748B] block">Paid (Verified)</span>
                        <span className="text-base font-bold text-[#166534] tabular-nums block mt-1">
                          {fmt(cPaid)}
                        </span>
                        {cDp > 0 && (
                          <span className="text-[10px] text-[#166534] font-medium block mt-0.5">
                            Incl. {fmt(cDp)} Advance
                          </span>
                        )}
                      </div>
                      <div className="py-2 sm:py-0 sm:px-4">
                        <span className="text-xs font-medium text-[#64748B] block">Remaining</span>
                        <span className="text-base font-bold text-[#0F4C3A] tabular-nums block mt-1">
                          {fmt(cRemaining)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="py-2">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="text-[#64748B]">Payment Progress</span>
                        <span className="font-bold text-[#0F4C3A]">
                          {cRemainingPct} remaining ({cPaidPct} paid)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#EAE8E2] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0F4C3A] rounded-full transition-all duration-400"
                          style={{ width: `${cProgressLineWidth}%` }}
                        />
                      </div>
                    </div>

                    {/* Next Installment Due Strip */}
                    <div className="mt-4 p-3.5 bg-[#FAF9F6] border border-[#EAE7E0] rounded-lg flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#FDF6EC] text-[#B89047] flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="text-xs">
                        <span className="text-[#64748B] block">Next Payment Schedule</span>
                        {nextDue ? (
                          <span className="font-semibold text-[#0B1B3D] text-sm mt-0.5 block">
                            Next Due: {fmtDate(nextDue.due_date)}{" "}
                            <span className="text-[#0F4C3A] font-bold">
                              ({fmt(nextDue.expected_amount)})
                            </span>
                          </span>
                        ) : (
                          <span className="font-semibold text-[#166534] text-sm mt-0.5 block">
                            ✓ All scheduled installments settled in full.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-5 pt-4 border-t border-[#F5F4EF]">
                      <Link
                        href={`/portal/contracts/${c.id}`}
                        className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-[#0B1B3D] bg-white border border-[#EAE7E0] hover:border-[#D6D2C7] rounded-lg transition-colors text-center"
                      >
                        View Full Schedule
                      </Link>
                      <Link
                        href={`/portal/contracts/${c.id}/pay`}
                        className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold text-white bg-[#0F4C3A] hover:bg-[#0A372A] rounded-lg shadow-sm transition-colors text-center flex items-center justify-center gap-1.5"
                      >
                        <span>Submit Payment</span>
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section: Payment History (Clean Ledger Table) */}
        <section id="payments" className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-xl font-bold text-[#0B1B3D]">
                Payment History
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EBF5F1] text-[#0F4C3A] border border-[#B7DFD1]">
                {(allPayments ?? []).length} Payment{(allPayments ?? []).length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="bg-white border border-[#EAE7E0] rounded-xl shadow-sm overflow-hidden">
            {(!allPayments || allPayments.length === 0) ? (
              <div className="text-center py-8 px-4 text-[#64748B]">
                <p className="text-xs font-medium">No payment transactions recorded yet.</p>
                <p className="text-[11px] text-[#9CA3AF] mt-1">
                  When you submit proof of payment, it will appear here with its live audit status.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#EAE7E0] text-[#64748B] font-semibold uppercase tracking-wider bg-[#FAF9F6]">
                      <th className="py-3.5 px-4 font-semibold">Amount</th>
                      <th className="py-3.5 px-4 font-semibold">Status</th>
                      <th className="py-3.5 px-4 font-semibold">Date</th>
                      <th className="py-3.5 px-4 font-semibold">Reference</th>
                      <th className="py-3.5 px-4 font-semibold">Asset</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F4EF]">
                    {(allPayments ?? []).map((p: any) => {
                      const badge = getStatusBadge(p.verification_status);
                      const productName = p.contracts?.products?.name || "Direct Payment";

                      return (
                        <tr key={p.id} className="hover:bg-[#FAF9F6] transition-colors">
                          <td className="py-3.5 px-4 font-bold text-[#0B1B3D] tabular-nums whitespace-nowrap">
                            {fmt(p.amount)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              style={{
                                color: badge.color,
                                backgroundColor: badge.bg,
                                borderColor: badge.border,
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                            >
                              <Check className="w-3 h-3" />
                              <span>{badge.label}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[#475569] tabular-nums whitespace-nowrap">
                            {fmtDate(p.payment_date || p.created_at)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[#0B1B3D] whitespace-nowrap">
                            {p.reference_number || "—"}
                          </td>
                          <td className="py-3.5 px-4 text-[#475569] whitespace-nowrap">
                            {productName}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {p.documents?.id ? (
                              <a
                                href={`/api/documents/${p.documents.id}/download`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F4C3A] hover:underline"
                              >
                                <span>Receipt</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-[#0F4C3A] font-semibold hover:underline cursor-pointer">
                                Receipt ↗
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
