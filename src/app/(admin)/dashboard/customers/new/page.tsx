"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createCustomer } from "@/lib/actions/customers";

interface Creds {
  customerId: string;
  customerCode: string;
  username: string;
  password: string;
  loginEmail: string;
}

export default function NewCustomerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    government_id: "",
    address: "",
    notes: "",
    password: "",
  });

  const [customPasswordMode, setCustomPasswordMode] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyAllSlip() {
    if (!creds) return;
    const text = `InstallPro Customer Portal Login\nCustomer: ${form.full_name}\nPortal URL: ${window.location.origin}/login\nUsername: ${creds.username}\nPassword: ${creds.password}`;
    await navigator.clipboard.writeText(text);
    setCopied("all");
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError("Full name is required.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await createCustomer({
        fullName: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        governmentId: form.government_id.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
        password: customPasswordMode && form.password.trim() ? form.password.trim() : undefined,
      });

      setCreds({
        customerId: res.customer.id,
        customerCode: res.credentials.customerCode,
        username: res.credentials.username,
        password: res.credentials.tempPassword,
        loginEmail: res.credentials.loginEmail,
      });
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Failed to create customer and portal login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in" style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <Link href="/dashboard/customers" className="hover:text-gray-900 transition-colors">
            Customers
          </Link>
          <span>/</span>
          <span>New Customer Registration</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 leading-tight">New Customer & Portal Account</h1>
        <p className="text-xs text-gray-500 mt-1">
          Register a customer and automatically generate their customer portal credentials to check contracts and pay installments.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Personal information */}
        <div className="card p-5 bg-white border border-gray-200 rounded-lg">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
            Personal Information
          </h2>
          <div className="space-y-4">
            <div className="field">
              <label className="field-label" htmlFor="full_name">
                Full Legal Name <span style={{ color: "#B91C1C" }}>*</span>
              </label>
              <input
                id="full_name"
                className="field-input"
                type="text"
                required
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                placeholder="e.g. Tariq Mansoor"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="field">
                <label className="field-label" htmlFor="phone">
                  Phone Number
                </label>
                <input
                  id="phone"
                  className="field-input tabular-nums"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+971 50 000 0000"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  className="field-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="Optional (personal email)"
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="government_id">
                Government ID / Emirates ID
              </label>
              <input
                id="government_id"
                className="field-input font-mono"
                type="text"
                value={form.government_id}
                onChange={(e) => set("government_id", e.target.value)}
                placeholder="784-XXXX-XXXXXXX-X"
              />
            </div>
          </div>
        </div>

        {/* Portal Login Configuration */}
        <div className="card p-5 bg-white border border-gray-200 rounded-lg">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Portal Login Credentials
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                The software will automatically create an account for this customer in Supabase Auth.
              </p>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-md text-xs text-emerald-900 mb-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <strong>Automated Username Assignment:</strong>
            </div>
            <p className="text-[11px] text-emerald-800">
              Customer username will be automatically assigned based on their unique customer code (e.g. <span className="font-mono font-semibold">cust-00001</span>), enabling instant login at <span className="font-mono">/login</span>.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="toggle-custom-pass"
                type="checkbox"
                checked={customPasswordMode}
                onChange={(e) => setCustomPasswordMode(e.target.checked)}
                className="rounded border-gray-300 text-emerald-800 focus:ring-emerald-700"
              />
              <label htmlFor="toggle-custom-pass" className="text-xs text-gray-700 select-none cursor-pointer">
                Specify custom password (otherwise a secure password will be generated)
              </label>
            </div>

            {customPasswordMode && (
              <div className="field">
                <label className="field-label" htmlFor="custom-password">
                  Initial Password
                </label>
                <input
                  id="custom-password"
                  className="field-input font-mono"
                  type="text"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
            )}
          </div>
        </div>

        {/* Address & Notes */}
        <div className="card p-5 bg-white border border-gray-200 rounded-lg space-y-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 border-b border-gray-100">
            Location & Ledger Notes
          </h2>
          <div className="field">
            <label className="field-label" htmlFor="address">
              Residential / Business Address
            </label>
            <textarea
              id="address"
              className="field-textarea"
              rows={2}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Full address, city, UAE"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="notes">
              Internal Ledger Notes
            </label>
            <textarea
              id="notes"
              className="field-textarea"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional remarks or customer references"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/dashboard/customers" className="btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn-primary"
            style={{ backgroundColor: "var(--primary)" }}
            disabled={loading}
          >
            {loading ? "Registering & Creating User…" : "Register Customer & Portal Login"}
          </button>
        </div>
      </form>

      {/* Credentials Modal */}
      {creds && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 className="modal-title text-emerald-900">Customer & Portal User Created!</h3>
            </div>

            <div className="modal-body space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900">
                <strong>The customer portal account has been created in the software.</strong>
                <p className="text-[11px] text-emerald-800 mt-1">
                  Copy these login credentials now. The customer can use them to log into their portal immediately to check active contracts, view installment schedules, and submit payments.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                  <div>
                    <span className="text-[11px] text-gray-500 block">Customer ID / Account Code</span>
                    <span className="font-mono font-bold text-gray-900 text-sm">{creds.customerCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(creds.customerCode, "code")}
                    className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    {copied === "code" ? "Copied!" : "Copy"}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                  <div>
                    <span className="text-[11px] text-gray-500 block">Login Username</span>
                    <span className="font-mono font-bold text-gray-900 text-sm">{creds.username}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(creds.username, "user")}
                    className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    {copied === "user" ? "Copied!" : "Copy"}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                  <div>
                    <span className="text-[11px] text-gray-500 block">Login Password</span>
                    <span className="font-mono font-bold text-emerald-800 text-sm">{creds.password}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(creds.password, "pass")}
                    className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    {copied === "pass" ? "Copied!" : "Copy"}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                  <div>
                    <span className="text-[11px] text-gray-500 block">Customer Login URL</span>
                    <span className="font-mono text-gray-700 text-xs">/login</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(`${window.location.origin}/login`, "url")}
                    className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    {copied === "url" ? "Copied!" : "Copy URL"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={copyAllSlip}
                className="w-full py-2.5 text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-md transition-colors"
              >
                {copied === "all" ? "✓ All Credentials Copied to Clipboard!" : "Copy WhatsApp / SMS Login Slip"}
              </button>
            </div>

            <div className="modal-footer flex items-center justify-between gap-3">
              <Link
                href={`/dashboard/contracts/new?customer_id=${creds.customerId}`}
                className="btn-secondary text-xs"
              >
                + Create Contract
              </Link>
              <button
                type="button"
                className="btn-primary"
                style={{ backgroundColor: "var(--primary)" }}
                onClick={() => router.push(`/dashboard/customers/${creds.customerId}`)}
              >
                Open Customer Profile →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
