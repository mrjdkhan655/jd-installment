"use client";

import { useState, useTransition } from "react";
import { reviewPaymentSubmission } from "@/lib/actions/payments";

export function VerifyActions({ paymentId }: { paymentId: string }) {
  const [isPending, startTransition] = useTransition();
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (done) {
    return (
      <div
        className="p-3 rounded-md text-xs font-medium"
        style={{
          backgroundColor: done === "approved" ? "var(--status-paid-bg)" : "var(--status-overdue-bg)",
          color: done === "approved" ? "var(--status-paid-text)" : "var(--status-overdue-text)",
          border: `1px solid ${done === "approved" ? "var(--status-paid-border)" : "var(--status-overdue-border)"}`,
        }}
      >
        {done === "approved"
          ? "Payment verified and credited to active contract ledger."
          : "Payment rejected. Customer will see the specified rejection rationale."}
      </div>
    );
  }

  function handleApprove() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await reviewPaymentSubmission({ paymentId, decision: "approved" });
        setDone("approved");
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to approve payment.");
      }
    });
  }

  function handleRejectSubmit() {
    if (!reason.trim()) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await reviewPaymentSubmission({ paymentId, decision: "rejected", rejectionReason: reason.trim() });
        setDone("rejected");
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to reject payment.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {errorMsg && (
        <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          {errorMsg}
        </div>
      )}

      {!isRejectMode ? (
        <div className="txn-action-zone">
          <button
            type="button"
            className="btn-reject"
            onClick={() => setIsRejectMode(true)}
            disabled={isPending}
          >
            Reject Submission
          </button>
          <button
            type="button"
            className="btn-approve"
            onClick={handleApprove}
            disabled={isPending}
          >
            {isPending ? "Auditing…" : "Verify & Credit Ledger"}
          </button>
        </div>
      ) : (
        <div className="rejection-form-drawer">
          <label htmlFor={`reason-${paymentId}`} className="text-xs font-medium text-red-900">
            Specify Rejection Reason (Disclosed to Customer)
          </label>
          <input
            type="text"
            id={`reason-${paymentId}`}
            className="field-input text-xs"
            placeholder="e.g., Transfer reference not found on bank statement"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
          <div className="drawer-actions">
            <button
              type="button"
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 bg-transparent border-none cursor-pointer"
              onClick={() => {
                setIsRejectMode(false);
                setReason("");
              }}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-confirm-reject"
              disabled={isPending || !reason.trim()}
              onClick={handleRejectSubmit}
            >
              {isPending ? "Submitting…" : "Confirm Rejection"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
