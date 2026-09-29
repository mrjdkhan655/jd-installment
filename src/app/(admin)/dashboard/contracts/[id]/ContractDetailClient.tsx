"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { recordAdminPayment } from "@/lib/actions/payments";
import { voidContract } from "@/lib/actions/contracts";
import { DeleteContractButton } from "@/components/contracts/DeleteContractButton";

const fmt = (n: number) =>
  "AED\u00A0" +
  n.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

interface ContractDetailClientProps {
  contract: any;
  installments: any[];
  officialPayments: any[];
  pendingPayments: any[];
  totalContract: number;
  confirmedReceived: number;
  netOutstanding: number;
}

export function ContractDetailClient({
  contract,
  installments,
  officialPayments,
  pendingPayments,
  totalContract,
  confirmedReceived,
  netOutstanding,
}: ContractDetailClientProps) {
  const [isPending, startTransition] = useTransition();

  // Record payment modal state
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedInstId, setSelectedInstId] = useState<string>("");
  const [recordAmount, setRecordAmount] = useState<string>("");
  const [recordMethod, setRecordMethod] = useState<string>("cash");
  const [recordDate, setRecordDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [recordRef, setRecordRef] = useState<string>("");
  const [recordNotes, setRecordNotes] = useState<string>("");
  const [recordError, setRecordError] = useState<string | null>(null);

  // Void contract modal state
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidCodeInput, setVoidCodeInput] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);

  // Derive safety void code e.g. VOID-088 from contract_number
  const suffix = contract.contract_number?.slice(-3) || "001";
  const expectedVoidCode = `VOID-${suffix}`;

  // Pre-calculate per installment receipts
  const installmentPaymentsMap = new Map<string, number>();
  const installmentReceiptsMap = new Map<string, string[]>();

  officialPayments.forEach((p) => {
    if (p.installment_id) {
      installmentPaymentsMap.set(
        p.installment_id,
        (installmentPaymentsMap.get(p.installment_id) ?? 0) + p.amount
      );
      const refs = installmentReceiptsMap.get(p.installment_id) || [];
      if (p.reference_number) refs.push(p.reference_number);
      else refs.push(`#${p.id.slice(0, 6)}`);
      installmentReceiptsMap.set(p.installment_id, refs);
    }
  });

  function openRecordForInst(inst: any) {
    const paidSoFar = installmentPaymentsMap.get(inst.id) ?? 0;
    const remaining = Math.max(0, inst.expected_amount - paidSoFar);
    setSelectedInstId(inst.id);
    setRecordAmount(remaining > 0 ? remaining.toFixed(2) : inst.expected_amount.toFixed(2));
    setRecordError(null);
    setShowRecordModal(true);
  }

  function handleRecordSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(recordAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setRecordError("Please specify a valid payment amount.");
      return;
    }

    setRecordError(null);
    const isDownPayment = selectedInstId === "down_payment";
    startTransition(async () => {
      try {
        await recordAdminPayment({
          contractId: contract.id,
          installmentId: isDownPayment ? undefined : (selectedInstId || undefined),
          amount: parsedAmount,
          paymentDate: recordDate,
          method: recordMethod as any,
          referenceNumber: isDownPayment ? (recordRef || "ADVANCE-DOWNPAYMENT") : (recordRef || undefined),
          notes: isDownPayment
            ? (recordNotes ? `${recordNotes} — Advance Down Payment` : "Advance Down Payment collected")
            : (recordNotes || undefined),
        });
        setShowRecordModal(false);
      } catch (err: any) {
        setRecordError(err.message || "Failed to record payment.");
      }
    });
  }

  function handleVoidSubmit() {
    if (voidCodeInput.trim().toUpperCase() !== expectedVoidCode) return;
    setVoidError(null);
    startTransition(async () => {
      try {
        await voidContract({
          contractId: contract.id,
          expectedCode: expectedVoidCode,
          providedCode: voidCodeInput,
          reason: voidReason || undefined,
        });
        setShowVoidModal(false);
      } catch (err: any) {
        setVoidError(err.message || "Failed to void contract.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* 2-Column Entity Information: Customer & Asset */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Information Card */}
        <div className="card p-5 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Customer Account
            </h3>
            <Link
              href={`/dashboard/customers/${contract.customers?.id}`}
              className="text-xs font-medium text-emerald-800 hover:underline"
            >
              Full Profile →
            </Link>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Legal Name:</span>
              <span className="font-semibold text-gray-900">{contract.customers?.full_name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Customer ID:</span>
              <span className="font-mono text-gray-700">{contract.customers?.customer_code ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phone:</span>
              <span className="tabular-nums text-gray-900">{contract.customers?.phone ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">National ID / EID:</span>
              <span className="font-mono text-gray-900">{contract.customers?.government_id ?? "—"}</span>
            </div>
          </div>
        </div>

        {/* Contract & Asset Specification Card */}
        <div className="card p-5 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Collateral & Terms
            </h3>
            <span className="text-xs text-gray-500 capitalize">
              {contract.products?.kind || "Item"}
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Asset Label:</span>
              <span className="font-semibold text-gray-900">{contract.products?.name ?? "Financed Goods"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Down Payment Received:</span>
              <span className="tabular-nums text-gray-900">{fmt(contract.down_payment ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Agreement Term:</span>
              <span className="text-gray-900">
                {fmtDate(contract.start_date)} — {fmtDate(contract.planned_end_date)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Extended-Term Penalty:</span>
              <span className="text-gray-900 font-medium">
                {contract.penalty_enabled ? "Enabled on late term" : "None / Standard Terms"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Installment Operational Ledger Table (Strict Column Typography — Section 3.4) */}
      <div className="card bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Installment Schedule Ledger
            </h2>
            <p className="text-xs text-gray-500">
              Contract source of truth: all amounts verified against bank deposits.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {contract.status === "active" && (
              <button
                type="button"
                onClick={() => {
                  setSelectedInstId("");
                  setRecordAmount("");
                  setShowRecordModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded hover:bg-emerald-900 transition-colors"
              >
                + Record Direct Payment
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[11px] tracking-wider">
                <th className="py-2.5 px-4 font-medium">Due Date</th>
                <th className="py-2.5 px-4 font-medium">Index</th>
                <th className="py-2.5 px-4 font-medium text-right">Installment Amount</th>
                <th className="py-2.5 px-4 font-medium text-right">Confirmed Received</th>
                <th className="py-2.5 px-4 font-medium text-right">Remaining</th>
                <th className="py-2.5 px-4 font-medium text-center">Operational Status</th>
                <th className="py-2.5 px-4 font-medium text-right">Transaction Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Number(contract.down_payment) > 0 && (
                <tr className="bg-emerald-50/50 hover:bg-emerald-50/70 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {contract.start_date ? new Date(contract.start_date).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-[#0F4C3A]">
                    #0 (Advance)
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900 tabular-nums">
                    AED {Number(contract.down_payment).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-800 tabular-nums">
                    AED {Number(contract.down_payment).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-700 font-medium tabular-nums">
                    AED 0.00
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="badge badge-paid">PAID AT SIGNING</span>
                  </td>
                  <td className="py-3 px-4 text-right text-xs text-gray-400">
                    Advance Credited
                  </td>
                </tr>
              )}
              {installments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    No installments scheduled for this contract.
                  </td>
                </tr>
              ) : (
                installments.map((inst) => {
                  const paid = installmentPaymentsMap.get(inst.id) ?? 0;
                  const remaining = Math.max(0, inst.expected_amount - paid);
                  const isSettled = remaining === 0 && inst.expected_amount > 0;
                  const isPartial = paid > 0 && remaining > 0;
                  const receipts = installmentReceiptsMap.get(inst.id) || [];

                  let badgeStatus = "neutral";
                  let badgeText = "Scheduled";
                  if (isSettled) {
                    badgeStatus = "paid";
                    badgeText = "Settled";
                  } else if (isPartial) {
                    badgeStatus = "partial";
                    badgeText = "Partial";
                  } else if (new Date(inst.due_date).getTime() < Date.now()) {
                    badgeStatus = "overdue";
                    badgeText = "Overdue";
                  }

                  return (
                    <tr key={inst.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4 font-medium tabular-nums text-gray-900">
                        {fmtDate(inst.due_date)}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600">
                        Inst #{inst.installment_number}
                        {inst.is_final ? " (Final)" : ""}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-gray-900">
                        {fmt(inst.expected_amount)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-emerald-800">
                        {fmt(paid)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-gray-900">
                        {fmt(remaining)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`badge badge-${badgeStatus}`}>
                          {badgeText}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isSettled ? (
                          <span className="text-[11px] text-gray-500 font-mono">
                            {receipts[0] ? receipts[0] : "Settled"}
                          </span>
                        ) : isPartial ? (
                          <button
                            type="button"
                            onClick={() => openRecordForInst(inst)}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                          >
                            Record Balance
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openRecordForInst(inst)}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                          >
                            Record Payment
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dangerous Administrative Actions: Void / Delete Contract Destructive Interlock */}
      <div className="card p-5 bg-white border border-red-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-red-900">
            Danger Zone · Administrative Operations
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Cancel this agreement or permanently delete the contract and all generated installment schedules.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {contract.status !== "cancelled" && (
            <button
              type="button"
              onClick={() => {
                setVoidCodeInput("");
                setVoidError(null);
                setShowVoidModal(true);
              }}
              className="px-3.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-300 rounded-md hover:bg-amber-100 transition-colors"
            >
              Void Contract…
            </button>
          )}
          <DeleteContractButton
            contractId={contract.id}
            contractNumber={contract.contract_number}
            redirectAfterDelete={true}
            label="Delete Contract Permanently"
            variant="button"
          />
        </div>
      </div>

      {/* ── Record Payment Modal ─────────────────────────────── */}
      {showRecordModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Record Direct Customer Payment</h3>
            </div>
            <form onSubmit={handleRecordSubmit}>
              <div className="modal-body space-y-4">
                {recordError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                    {recordError}
                  </div>
                )}

                <div className="field">
                  <label className="field-label">Target Installment</label>
                  <select
                    className="field-select"
                    value={selectedInstId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedInstId(id);
                      if (id) {
                        const inst = installments.find((i) => i.id === id);
                        if (inst) {
                          const paid = installmentPaymentsMap.get(id) ?? 0;
                          setRecordAmount(Math.max(0, inst.expected_amount - paid).toFixed(2));
                        }
                      }
                    }}
                  >
                    <option value="">General Contract Balance (Unallocated)</option>
                    <option value="down_payment">Advance Down Payment (Contract Signing Advance)</option>
                    {installments.map((i) => (
                      <option key={i.id} value={i.id}>
                        Inst #{i.installment_number} — Due {fmtDate(i.due_date)} ({fmt(i.expected_amount)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label className="field-label">Amount (AED)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="field-input tabular-nums"
                      value={recordAmount}
                      onChange={(e) => setRecordAmount(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Payment Date</label>
                    <input
                      type="date"
                      className="field-input"
                      value={recordDate}
                      onChange={(e) => setRecordDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label className="field-label">Method</label>
                    <select
                      className="field-select"
                      value={recordMethod}
                      onChange={(e) => setRecordMethod(e.target.value)}
                    >
                      <option value="cash">Walk-in Cash</option>
                      <option value="bank_transfer">Direct Wire / Wire Transfer</option>
                      <option value="online">Card / POS Terminal</option>
                      <option value="other">Other Instrument</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Reference #</label>
                    <input
                      type="text"
                      className="field-input"
                      value={recordRef}
                      onChange={(e) => setRecordRef(e.target.value)}
                      placeholder="e.g. REC-892"
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Ledger Notes</label>
                  <input
                    type="text"
                    className="field-input"
                    value={recordNotes}
                    onChange={(e) => setRecordNotes(e.target.value)}
                    placeholder="Optional details or receipt confirmation"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowRecordModal(false)}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ backgroundColor: "var(--primary)" }}
                  disabled={isPending}
                >
                  {isPending ? "Recording…" : "Post to Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Destructive Interlock Modal (Section 4) ───────────── */}
      {showVoidModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog destructive-lock-frame" role="alertdialog" aria-modal="true">
            <div className="modal-header">
              <h3 className="modal-title">Void Active Contract #{contract.contract_number}</h3>
            </div>

            <div className="modal-body">
              {voidError && (
                <div className="p-3 mb-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                  {voidError}
                </div>
              )}

              <p className="modal-consequence-text">
                You are about to cancel this agreement. This action permanently stops future automatic installments and moves this account to the Cancelled Ledger.
              </p>

              <div className="modal-metric-summary">
                <div>Remaining Uncollected Balance: <strong>{fmt(netOutstanding)}</strong></div>
                <div>Settled Payments Recorded: <strong>{fmt(confirmedReceived)}</strong></div>
              </div>

              <div className="confirmation-input-block">
                <label htmlFor="void-confirm-code" className="field-label">
                  Type <strong>{expectedVoidCode}</strong> to confirm cancellation:
                </label>
                <input
                  type="text"
                  id="void-confirm-code"
                  className="field-input font-mono uppercase"
                  placeholder={expectedVoidCode}
                  autoComplete="off"
                  value={voidCodeInput}
                  onChange={(e) => setVoidCodeInput(e.target.value)}
                />
              </div>

              <div className="mt-3">
                <label className="field-label">Cancellation Reason</label>
                <input
                  type="text"
                  className="field-input"
                  placeholder="e.g. Asset return or default agreement"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowVoidModal(false)}
                disabled={isPending}
              >
                Dismiss & Return
              </button>
              <button
                type="button"
                id="btn-destructive-action"
                className="btn-danger"
                disabled={isPending || voidCodeInput.trim().toUpperCase() !== expectedVoidCode}
                onClick={handleVoidSubmit}
              >
                {isPending ? "Cancelling…" : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
