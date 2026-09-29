"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCustomer } from "@/lib/actions/customers";

interface DeleteCustomerButtonProps {
  customerId: string;
  customerName: string;
  customerCode?: string;
  redirectAfterDelete?: boolean;
  label?: string;
  className?: string;
  variant?: "button" | "icon" | "danger-outline";
}

export function DeleteCustomerButton({
  customerId,
  customerName,
  customerCode,
  redirectAfterDelete = false,
  label = "Delete Customer",
  className = "",
  variant = "danger-outline",
}: DeleteCustomerButtonProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteCustomer({ customerId });
        setShowModal(false);
        if (redirectAfterDelete) {
          router.push("/dashboard/customers");
        } else {
          router.refresh();
        }
      } catch (err: any) {
        setError(err.message || "Failed to delete customer");
      }
    });
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          title={`Delete Customer ${customerName}`}
          className={`text-gray-400 hover:text-red-600 p-1.5 rounded transition-colors ${className}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      ) : variant === "button" ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors ${className}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors ${className}`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {label}
        </button>
      )}

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog destructive-lock-frame" role="alertdialog" aria-modal="true">
            <div className="modal-header">
              <h3 className="modal-title text-red-900">Delete Customer Account</h3>
            </div>

            <div className="modal-body space-y-3">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                  {error}
                </div>
              )}

              <p className="text-xs text-gray-600 leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-gray-900">{customerName}</strong> {customerCode ? `(${customerCode})` : ""}?
              </p>

              <div className="p-3 bg-red-50/70 border border-red-200/80 rounded-md text-xs text-red-800 space-y-1">
                <p className="font-semibold">⚠️ Irreversible Account Removal</p>
                <p className="text-[11px] text-red-700">
                  This will permanently delete this customer profile, any portal login credentials, and all contracts, installment schedules, and payment history associated with this account.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowModal(false)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={isPending}
                onClick={handleDelete}
              >
                {isPending ? "Deleting…" : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
