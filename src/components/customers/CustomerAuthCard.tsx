"use client";

import { useState, useTransition } from "react";
import { createOrResetCustomerAuth } from "@/lib/actions/customers";

interface CustomerAuthCardProps {
  customerId: string;
  customerName: string;
  customerCode: string;
  hasAuthAccount: boolean;
}

export function CustomerAuthCard({
  customerId,
  customerName,
  customerCode,
  hasAuthAccount,
}: CustomerAuthCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generatedCreds, setGeneratedCreds] = useState<{
    username: string;
    customerCode: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAction = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await createOrResetCustomerAuth({
          customerId,
          customPassword: customPassword.trim() || undefined,
        });
        setGeneratedCreds(res);
      } catch (err: any) {
        setError(err.message || "Failed to generate portal login");
      }
    });
  };

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const copySlip = async () => {
    if (!generatedCreds) return;
    const text = `InstallPro Customer Portal Login\nCustomer: ${customerName}\nPortal URL: ${window.location.origin}/login\nUsername: ${generatedCreds.username}\nPassword: ${generatedCreds.tempPassword}`;
    await navigator.clipboard.writeText(text);
    setCopied("all");
    setTimeout(() => setCopied(null), 2000);
  };

  const username = customerCode.toLowerCase();

  return (
    <div className="card p-5 bg-white border border-gray-200 rounded-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Customer Portal Access & Login
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Customer can sign in at <code className="text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded">/login</code> to review their contracts and submit payments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setGeneratedCreds(null);
            setError(null);
            setCustomPassword("");
            setShowModal(true);
          }}
          className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors shrink-0 inline-flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          {hasAuthAccount ? "Reset Portal Password" : "Create Portal Login"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
        <div>
          <span className="text-gray-500 block">Portal Username</span>
          <span className="font-mono font-semibold text-gray-900">{username}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Status</span>
          <span className={`inline-flex items-center gap-1.5 font-medium ${hasAuthAccount ? "text-emerald-700" : "text-amber-700"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${hasAuthAccount ? "bg-emerald-600" : "bg-amber-600"}`}></span>
            {hasAuthAccount ? "Active Account Linked" : "Login Not Yet Created"}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block">Customer Web Portal</span>
          <a
            href="/login"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-800 hover:underline font-medium inline-flex items-center gap-1"
          >
            Open Login Page ↗
          </a>
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {hasAuthAccount ? "Reset Portal Login Password" : "Create Customer Portal Account"}
              </h3>
            </div>

            <div className="modal-body space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                  {error}
                </div>
              )}

              {!generatedCreds ? (
                <>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    This will configure portal login credentials for <strong>{customerName}</strong>. The customer can use these credentials to log in and track their contracts, view payment schedules, and upload receipts.
                  </p>

                  <div className="p-3 bg-gray-50 rounded border border-gray-200 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Username:</span>
                      <strong className="font-mono text-gray-900">{username}</strong>
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label">Custom Password (Optional)</label>
                    <input
                      type="text"
                      className="field-input font-mono"
                      placeholder="Leave blank to auto-generate a secure password"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      If left blank, a secure 10-character password will be automatically generated.
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                    <strong>Portal login credentials generated successfully!</strong>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Copy these credentials now to give to the customer.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded border border-gray-200">
                      <div>
                        <span className="text-[11px] text-gray-500 block">Login Username</span>
                        <span className="font-mono font-bold text-gray-900 text-sm">
                          {generatedCreds.username}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copy(generatedCreds.username, "user")}
                        className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      >
                        {copied === "user" ? "Copied!" : "Copy"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded border border-gray-200">
                      <div>
                        <span className="text-[11px] text-gray-500 block">Password</span>
                        <span className="font-mono font-bold text-emerald-900 text-sm">
                          {generatedCreds.tempPassword}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copy(generatedCreds.tempPassword, "pass")}
                        className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      >
                        {copied === "pass" ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={copySlip}
                    className="w-full py-2 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition-colors"
                  >
                    {copied === "all" ? "✓ All Credentials Copied to Clipboard" : "Copy Full WhatsApp / SMS Slip"}
                  </button>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowModal(false)}
                disabled={isPending}
              >
                {generatedCreds ? "Close" : "Cancel"}
              </button>

              {!generatedCreds && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ backgroundColor: "var(--primary)" }}
                  onClick={handleAction}
                  disabled={isPending}
                >
                  {isPending ? "Generating…" : hasAuthAccount ? "Update Password" : "Create Login Account"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
