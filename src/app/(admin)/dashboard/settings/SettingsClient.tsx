"use client";

import { useState, useTransition } from "react";
import { updateBusinessSettings } from "@/lib/actions/settings";
import { changeUserPassword } from "@/lib/actions/auth";
import { Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function SettingsClient({ settings }: { settings: any }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password change state
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (pwNew.length < 6) {
      setPwError("Password must be at least 6 characters long.");
      return;
    }

    if (pwNew !== pwConfirm) {
      setPwError("Passwords do not match.");
      return;
    }

    setPwLoading(true);
    try {
      const res = await changeUserPassword(pwNew);
      if (!res.success) {
        setPwError(res.error || "Failed to update password.");
      } else {
        setPwSuccess(true);
        setPwNew("");
        setPwConfirm("");
        setTimeout(() => setPwSuccess(false), 4000);
      }
    } catch {
      setPwError("Network error while updating password.");
    } finally {
      setPwLoading(false);
    }
  }

  const [form, setForm] = useState({
    businessName: settings?.business_name ?? "",
    businessAddress: settings?.business_address ?? "",
    businessPhone: settings?.business_phone ?? "",
    businessEmail: settings?.business_email ?? "",
    defaultPenaltyMethod: settings?.default_penalty_method ?? "",
    defaultPenaltyValue: settings?.default_penalty_value?.toString() ?? "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        await updateBusinessSettings({
          businessName: form.businessName.trim(),
          businessAddress: form.businessAddress.trim() || undefined,
          businessPhone: form.businessPhone.trim() || undefined,
          businessEmail: form.businessEmail.trim() || undefined,
          defaultPenaltyMethod: (form.defaultPenaltyMethod || null) as any,
          defaultPenaltyValue: form.defaultPenaltyValue
            ? parseFloat(form.defaultPenaltyValue)
            : null,
        });
        setSuccess(true);
      } catch (err: any) {
        setError(err?.message || "Could not save settings.");
      }
    });
  }

  return (
    <div
      className="card"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        padding: "24px",
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
      }}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {error && (
            <div
              style={{
                backgroundColor: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: 6,
                padding: "10px 14px",
                color: "#B91C1C",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                backgroundColor: "#F0FDF4",
                border: "1px solid #86EFAC",
                borderRadius: 6,
                padding: "10px 14px",
                color: "#166534",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>✓</span>
              <span>Settings saved successfully.</span>
            </div>
          )}

          {/* Business Name */}
          <div className="field">
            <label
              className="field-label"
              style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", marginBottom: 4 }}
            >
              Business Name *
            </label>
            <input
              type="text"
              required
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              placeholder="e.g. Al Baraka Trading LLC"
              className="field-input"
              style={{ minHeight: 40, fontSize: 14 }}
            />
          </div>

          {/* Business Address */}
          <div className="field">
            <label
              className="field-label"
              style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", marginBottom: 4 }}
            >
              Business Address
            </label>
            <textarea
              rows={2}
              value={form.businessAddress}
              onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
              placeholder="Building, Street, Area, Emirate"
              className="field-textarea"
              style={{ fontSize: 14 }}
            />
          </div>

          {/* Phone & Email side by side */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <div className="field">
              <label
                className="field-label"
                style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", marginBottom: 4 }}
              >
                Official Phone
              </label>
              <input
                type="tel"
                value={form.businessPhone}
                onChange={(e) => setForm({ ...form, businessPhone: e.target.value })}
                placeholder="+971 4 123 4567"
                className="field-input"
                style={{ minHeight: 40, fontSize: 14 }}
              />
            </div>

            <div className="field">
              <label
                className="field-label"
                style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", marginBottom: 4 }}
              >
                Official Email
              </label>
              <input
                type="email"
                value={form.businessEmail}
                onChange={(e) => setForm({ ...form, businessEmail: e.target.value })}
                placeholder="contact@business.ae"
                className="field-input"
                style={{ minHeight: 40, fontSize: 14 }}
              />
            </div>
          </div>

          {/* Divided Section: Default Penalty Rule */}
          <div
            style={{
              paddingTop: 18,
              marginTop: 4,
              borderTop: "1px solid #E5E7EB",
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: "#111418", margin: 0 }}>
              Default Penalty Rule
            </p>
            <p
              style={{
                fontSize: 12,
                color: "#8A9099",
                marginTop: 4,
                marginBottom: 14,
                lineHeight: 1.4,
              }}
            >
              Pre-fills new agreements. A penalty applies only if the contract runs longer than the agreed term — never because an individual installment was paid late.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              <div className="field">
                <label
                  className="field-label"
                  style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", marginBottom: 4 }}
                >
                  Calculation Method
                </label>
                <select
                  value={form.defaultPenaltyMethod}
                  onChange={(e) =>
                    setForm({ ...form, defaultPenaltyMethod: e.target.value })
                  }
                  className="field-select"
                  style={{ minHeight: 40, fontSize: 14 }}
                >
                  <option value="">No penalty (Default)</option>
                  <option value="fixed_per_month">Fixed AED per extended month</option>
                  <option value="percent_per_month">Percent (%) per extended month</option>
                  <option value="custom_amount">One-time amount</option>
                  <option value="custom_rule">Custom rule / negotiated</option>
                </select>
              </div>

              {form.defaultPenaltyMethod && (
                <div className="field">
                  <label
                    className="field-label"
                    style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", marginBottom: 4 }}
                  >
                    Value (AED or %)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.defaultPenaltyValue}
                    onChange={(e) =>
                      setForm({ ...form, defaultPenaltyValue: e.target.value })
                    }
                    placeholder="e.g. 500 or 2"
                    className="field-input"
                    style={{ minHeight: 40, fontSize: 14 }}
                  />
                </div>
              )}
            </div>
          </div>

          <div style={{ paddingTop: 8 }}>
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary"
              style={{
                height: 40,
                padding: "0 20px",
                backgroundColor: "#0F4C3A",
                color: "#FFFFFF",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                border: "none",
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </div>
      </form>

      {/* Direct Administrator Security & Password Card */}
      <div
        style={{
          marginTop: 32,
          paddingTop: 24,
          borderTop: "1px solid #EAE7E0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: "#FDF6EC",
              border: "1px solid #F5E8D0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#B89047",
            }}
          >
            <Lock style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0B1B3D", margin: 0 }}>
              Administrator Security & Password
            </h3>
            <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
              Directly update your administrator login password on the server.
            </p>
          </div>
        </div>

        {pwSuccess && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: "#166534",
              marginBottom: 16,
            }}
          >
            <CheckCircle2 style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>Administrator password updated successfully on the server!</span>
          </div>
        )}

        {pwError && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: "#B91C1C",
              marginBottom: 16,
            }}
          >
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>{pwError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#0B1B3D", marginBottom: 6 }}>
                New Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  style={{
                    width: "100%",
                    height: 40,
                    padding: "0 36px 0 12px",
                    backgroundColor: "#FAF9F6",
                    border: "1px solid #EAE7E0",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#0B1B3D",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94A3B8",
                  }}
                >
                  {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#0B1B3D", marginBottom: 6 }}>
                Confirm New Password
              </label>
              <input
                type={showPw ? "text" : "password"}
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                placeholder="Repeat new password"
                required
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  backgroundColor: "#FAF9F6",
                  border: "1px solid #EAE7E0",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#0B1B3D",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pwLoading}
            style={{
              height: 40,
              padding: "0 20px",
              backgroundColor: "#0B1B3D",
              color: "#FFFFFF",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: pwLoading ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Lock style={{ width: 14, height: 14 }} />
            <span>{pwLoading ? "Updating Password…" : "Update Admin Password"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
