import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ContractDetailClient } from "./ContractDetailClient";

export const metadata = { title: "Contract Detail — InstallPro" };

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const resolvedParams = await params;
  const contractId = resolvedParams.id;

  // Fetch contract with customer and product
  const { data: contract, error } = await supabase
    .from("contracts")
    .select(`
      *,
      customers (
        id,
        customer_code,
        full_name,
        phone,
        government_id,
        address
      ),
      products (
        id,
        name,
        kind,
        reference_number
      )
    `)
    .eq("id", contractId)
    .single();

  if (error) {
    console.error("Contract detail fetch error:", error);
  }

  if (!contract) {
    notFound();
  }

  // Fetch installments
  const { data: installments } = await supabase
    .from("installment_schedules")
    .select("*")
    .eq("contract_id", contractId)
    .order("installment_number", { ascending: true });

  // Fetch official approved payments
  const { data: officialPayments } = await supabase
    .from("payments")
    .select("*")
    .eq("contract_id", contractId)
    .in("verification_status", ["not_required", "approved"])
    .order("payment_date", { ascending: false });

  // Fetch pending payments
  const { data: pendingPayments } = await supabase
    .from("payments")
    .select("*")
    .eq("contract_id", contractId)
    .eq("verification_status", "pending")
    .order("payment_date", { ascending: false });

  const totalContract = contract.total_amount ?? 0;
  const rawConfirmedReceived = officialPayments?.reduce((s, p) => s + p.amount, 0) ?? 0;
  const dp = Number(contract.down_payment) || 0;
  const hasDpInPayments = (officialPayments ?? []).some(
    (p) => p.reference_number === "ADVANCE-DOWNPAYMENT" || (p.notes && p.notes.toLowerCase().includes("down payment"))
  );
  const confirmedReceived = rawConfirmedReceived + (hasDpInPayments ? 0 : dp);
  const netOutstanding = Math.max(0, totalContract - confirmedReceived);
  const pendingTotal = pendingPayments?.reduce((s, p) => s + p.amount, 0) ?? 0;

  const paidFraction = totalContract > 0 ? (confirmedReceived / totalContract) * 100 : 0;
  const remainingFraction = Math.max(0, 100 - paidFraction);
  const paidPctFormatted = paidFraction === 0 ? "0%" : paidFraction < 1 ? `${paidFraction.toFixed(1)}%` : Number.isInteger(paidFraction) ? `${paidFraction}%` : `${paidFraction.toFixed(1)}%`;
  const remainingPctFormatted = remainingFraction === 100 ? "100%" : remainingFraction > 99 ? `${remainingFraction.toFixed(1)}%` : Number.isInteger(remainingFraction) ? `${remainingFraction}%` : `${remainingFraction.toFixed(1)}%`;
  const progressLineWidth = confirmedReceived > 0 ? Math.max(2, Math.min(100, paidFraction)) : 0;

  return (
    <div className="fade-in space-y-6">
      {/* Breadcrumb & Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/dashboard/contracts" className="hover:text-gray-900 transition-colors">
              Contracts
            </Link>
            <span>/</span>
            <span className="font-mono text-gray-800 font-medium">{contract.contract_number}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              Contract #{contract.contract_number}
            </h1>
            <span className={`badge badge-${contract.status}`}>
              {contract.status.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/dashboard/contracts/${contract.id}/preview`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F4C3A] hover:bg-[#0C3D2E] rounded-md shadow-sm transition-colors"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview & Print Agreement
          </Link>
          <a
            href={`/api/agreements/${contract.id}?download=true`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            title="Download compiled PDF agreement file"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PDF
          </a>
        </div>
      </div>

      {/* Financial Status Header Strip (Section 3.4) */}
      <div className="financial-balance-strip">
        <div className="balance-cell">
          <span className="cell-label">Total Contract</span>
          <span className="cell-val">AED {totalContract.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
        </div>
        {contract.down_payment > 0 && (
          <div className="balance-cell" style={{ backgroundColor: "#F0FDF4" }}>
            <span className="cell-label" style={{ color: "#166534" }}>Advance Down Payment</span>
            <span className="cell-val color-confirmed">AED {Number(contract.down_payment).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
            <span className="cell-subtext" style={{ color: "#166534" }}>Deducted as advance from total</span>
          </div>
        )}
        <div className="balance-cell">
          <span className="cell-label">Confirmed Received</span>
          <span className="cell-val color-confirmed">AED {confirmedReceived.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="balance-cell">
          <span className="cell-label">Net Outstanding</span>
          <span className="cell-val color-outstanding">AED {netOutstanding.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="balance-cell unverified-warning-box">
          <span className="cell-label">Pending Verification</span>
          <span className="cell-val color-pending">AED {pendingTotal.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
          <span className="cell-subtext">Excluded from balance until approved</span>
        </div>
      </div>

      {/* Real-Time Settlement Progress Line */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
          <span className="font-semibold text-gray-700">Settlement Progress</span>
          <span className="font-bold text-[#0F4C3A]">
            {remainingPctFormatted} remaining ({paidPctFormatted} paid)
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0F4C3A] rounded-full transition-all duration-400"
            style={{ width: `${progressLineWidth}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-gray-400 mt-1.5">
          <span>Paid: AED {confirmedReceived.toLocaleString("en-AE", { minimumFractionDigits: 2 })} ({paidPctFormatted})</span>
          <span>Remaining: AED {netOutstanding.toLocaleString("en-AE", { minimumFractionDigits: 2 })} ({remainingPctFormatted})</span>
        </div>
      </div>

      {/* Client Component handling ledger, quick record payment, and destructive void modal */}
      <ContractDetailClient
        contract={contract}
        installments={installments ?? []}
        officialPayments={officialPayments ?? []}
        pendingPayments={pendingPayments ?? []}
        totalContract={totalContract}
        confirmedReceived={confirmedReceived}
        netOutstanding={netOutstanding}
      />
    </div>
  );
}
