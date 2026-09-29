"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createStaffUser,
  setUserActive,
  changeUserRole,
  assignUserSections,
  adminResetUserPassword,
} from "@/lib/actions/users";

interface UserProfile {
  id: string;
  role: "admin" | "super_admin";
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean | null;
  created_at: string;
  assigned_sections?: string[];
}

const AVAILABLE_SECTIONS = [
  {
    key: "ledger",
    title: "Executive Ledgers",
    desc: "Customer balances, paid, remaining & statements (Mobile-first view)",
    icon: "📊",
  },
  {
    key: "overview",
    title: "Dashboard & Overview",
    desc: "Financial summary, KPI metrics, upcoming dues & recent cash book entries",
    icon: "🏠",
  },
  {
    key: "customers",
    title: "Customer Directory",
    desc: "Customer profiles, contact info, Emirates ID and account files",
    icon: "👥",
  },
  {
    key: "contracts",
    title: "Contracts & Collateral",
    desc: "Installment agreements, vehicles and gold collateral inventory",
    icon: "📄",
  },
  {
    key: "payments",
    title: "Finance & Payments",
    desc: "Record receipts, installment schedules, audit queue & reports",
    icon: "💳",
  },
  {
    key: "documents",
    title: "Documents & Files",
    desc: "Official contracts, agreements and uploaded verification proofs",
    icon: "📁",
  },
  {
    key: "administration",
    title: "Administration",
    desc: "Staff management, security controls, settings & audit trails",
    icon: "⚙️",
  },
];

export default function UsersClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserProfile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Section assignment modal state
  const [sectionModalUser, setSectionModalUser] = useState<UserProfile | null>(null);
  const [selectedSections, setSelectedSections] = useState<string[]>(["all"]);

  // Direct password reset state
  const [pwdModalUser, setPwdModalUser] = useState<UserProfile | null>(null);
  const [customPassword, setCustomPassword] = useState("");
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "admin" as "admin" | "super_admin",
  });

  async function copyToClipboard(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim()) {
      setError("Please fill in both full name and email.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await createStaffUser(form);
        setCreatedCreds(res);
        setShowForm(false);
        setForm({ fullName: "", email: "", phone: "", role: "admin" });
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Could not create user account.");
      }
    });
  }

  function handleToggleActive(userId: string, currentActive: boolean | null) {
    startTransition(async () => {
      try {
        await setUserActive(userId, !currentActive);
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Could not update user status.");
      }
    });
  }

  function handleRoleChange(userId: string, newRole: "admin" | "super_admin") {
    startTransition(async () => {
      try {
        await changeUserRole(userId, newRole);
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Could not change role.");
      }
    });
  }

  function openSectionModal(user: UserProfile) {
    setSectionModalUser(user);
    const existing = user.assigned_sections && user.assigned_sections.length > 0
      ? user.assigned_sections
      : ["all"];
    setSelectedSections(existing);
    setError(null);
    setSuccessMsg(null);
  }

  function toggleSection(key: string) {
    if (key === "all") {
      setSelectedSections(["all"]);
      return;
    }

    let next = selectedSections.filter((k) => k !== "all");
    if (next.includes(key)) {
      next = next.filter((k) => k !== key);
    } else {
      next.push(key);
    }

    if (next.length === 0) {
      next = ["ledger"]; // default to at least ledger
    } else if (next.length === AVAILABLE_SECTIONS.length) {
      next = ["all"];
    }

    setSelectedSections(next);
  }

  function applyPreset(preset: "ledger_only" | "full" | "finance") {
    if (preset === "ledger_only") {
      setSelectedSections(["ledger"]);
    } else if (preset === "full") {
      setSelectedSections(["all"]);
    } else if (preset === "finance") {
      setSelectedSections(["ledger", "overview", "customers", "payments"]);
    }
  }

  function handleSaveSections() {
    if (!sectionModalUser) return;
    setError(null);
    startTransition(async () => {
      try {
        await assignUserSections(sectionModalUser.id, selectedSections);
        setSuccessMsg(`Menu sections updated successfully for ${sectionModalUser.full_name || sectionModalUser.email}.`);
        setSectionModalUser(null);
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Could not update user sections.");
      }
    });
  }

  function openPwdModal(user: UserProfile) {
    setPwdModalUser(user);
    setCustomPassword("");
    setError(null);
    setResetResult(null);
  }

  function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwdModalUser) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await adminResetUserPassword(pwdModalUser.id, customPassword || undefined);
        setResetResult({
          email: pwdModalUser.email || "User",
          password: res.newPassword,
        });
        setPwdModalUser(null);
        setSuccessMsg(`Password successfully updated on server for ${pwdModalUser.email}.`);
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Could not update user password.");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1. Accent-tinted explainer card stating the permission model */}
      <div
        style={{
          backgroundColor: "#EAF3EF",
          border: "1px solid #C2E0D4",
          borderRadius: 8,
          padding: "16px 20px",
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#0F4C3A",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          Staff Permission Model
        </p>
        <p
          style={{
            fontSize: 12,
            color: "#0C3D2E",
            marginTop: 4,
            marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          Admins handle day-to-day operations: customers, contracts, payments, verification and reports. Users, audit log and business settings remain restricted to the Super Admin.
        </p>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: "#FEF2F2",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            padding: "12px 16px",
            color: "#B91C1C",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            backgroundColor: "#EAF3EF",
            border: "1px solid #C2E0D4",
            borderRadius: 8,
            padding: "12px 16px",
            color: "#0F4C3A",
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>✓ {successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            style={{ background: "none", border: "none", color: "#0F4C3A", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Add User Button & Form */}
      {!showForm ? (
        <div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowForm(true)}
            style={{
              height: 40,
              padding: "0 16px",
              backgroundColor: "#0F4C3A",
              color: "#FFFFFF",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            + Add Staff User
          </button>
        </div>
      ) : (
        <div
          className="card"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: "20px",
            boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
          }}
        >
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#111418",
              marginTop: 0,
              marginBottom: 16,
            }}
          >
            Create Staff Account
          </h2>

          <form onSubmit={handleCreateUser}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
                marginBottom: 16,
              }}
            >
              <div className="field">
                <label
                  className="field-label"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#8A9099",
                    marginBottom: 4,
                  }}
                >
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="e.g. Tariq Mansoor"
                  className="field-input"
                  style={{ minHeight: 40, fontSize: 14 }}
                />
              </div>

              <div className="field">
                <label
                  className="field-label"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#8A9099",
                    marginBottom: 4,
                  }}
                >
                  Work Email *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="staff@business.ae"
                  className="field-input"
                  style={{ minHeight: 40, fontSize: 14 }}
                />
              </div>

              <div className="field">
                <label
                  className="field-label"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#8A9099",
                    marginBottom: 4,
                  }}
                >
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+971 50 123 4567"
                  className="field-input"
                  style={{ minHeight: 40, fontSize: 14 }}
                />
              </div>

              <div className="field">
                <label
                  className="field-label"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#8A9099",
                    marginBottom: 4,
                  }}
                >
                  Role *
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as "admin" | "super_admin" })
                  }
                  className="field-select"
                  style={{ minHeight: 40, fontSize: 14 }}
                >
                  <option value="admin">Admin (Day-to-day)</option>
                  <option value="super_admin">Super Admin (Full Access)</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowForm(false)}
                style={{
                  height: 38,
                  padding: "0 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  border: "1px solid #E5E7EB",
                  backgroundColor: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn-primary"
                style={{
                  height: 38,
                  padding: "0 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  backgroundColor: "#0F4C3A",
                  color: "#FFFFFF",
                  border: "none",
                  cursor: isPending ? "not-allowed" : "pointer",
                }}
              >
                {isPending ? "Creating…" : "Save & Generate Password"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Credentials Modal (Copy-once warning) */}
      {createdCreds && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(17, 20, 24, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              maxWidth: 480,
              width: "100%",
              padding: "24px",
              boxShadow: "0 4px 6px rgba(16,24,40,0.05), 0 10px 15px rgba(16,24,40,0.08)",
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#111418",
                margin: "0 0 8px",
              }}
            >
              Account Created Successfully
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "#4B5563",
                margin: "0 0 16px",
                lineHeight: 1.4,
              }}
            >
              Please share these credentials with the team member.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Email row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 6,
                  backgroundColor: "#F7F8FA",
                }}
              >
                <div>
                  <p style={{ fontSize: 11, color: "#8A9099", margin: 0 }}>Login Email</p>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#111418", margin: "2px 0 0" }}>
                    {createdCreds.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdCreds.email, "email")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid #E5E7EB",
                    backgroundColor: "#FFFFFF",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {copiedField === "email" ? "Copied" : "Copy"}
                </button>
              </div>

              {/* Password row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 6,
                  backgroundColor: "#F7F8FA",
                }}
              >
                <div>
                  <p style={{ fontSize: 11, color: "#8A9099", margin: 0 }}>Temporary Password</p>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "monospace",
                      color: "#0F4C3A",
                      margin: "2px 0 0",
                    }}
                  >
                    {createdCreds.tempPassword}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdCreds.tempPassword, "password")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid #E5E7EB",
                    backgroundColor: "#FFFFFF",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {copiedField === "password" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Crucial copy warning */}
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#B45309",
                marginTop: 14,
                marginBottom: 20,
              }}
            >
              The password is shown only once — copy it now.
            </p>

            <button
              type="button"
              className="btn-primary"
              onClick={() => setCreatedCreds(null)}
              style={{
                width: "100%",
                height: 40,
                backgroundColor: "#0F4C3A",
                color: "#FFFFFF",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* 4. Assign Menu Sections Modal */}
      {sectionModalUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(17, 20, 24, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            className="card"
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              maxWidth: 580,
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #E5E7EB" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111418", margin: 0 }}>
                    Configure Menu Access
                  </h2>
                  <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4, margin: 0 }}>
                    Assign which sections are visible to <strong>{sectionModalUser.full_name || sectionModalUser.email}</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSectionModalUser(null)}
                  style={{ background: "none", border: "none", fontSize: 18, color: "#6B7280", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              {/* 1-Click Fast Presets */}
              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => applyPreset("ledger_only")}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: 20,
                    backgroundColor: selectedSections.length === 1 && selectedSections[0] === "ledger" ? "#0F4C3A" : "#EAF3EF",
                    color: selectedSections.length === 1 && selectedSections[0] === "ledger" ? "#FFFFFF" : "#0F4C3A",
                    border: "1px solid #C2E0D4",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  📱 Executive Ledger Only (Recommended for Papa)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("full")}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: 20,
                    backgroundColor: selectedSections.includes("all") ? "#0B1B3D" : "#F3F4F6",
                    color: selectedSections.includes("all") ? "#FFFFFF" : "#374151",
                    border: "1px solid #E5E7EB",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  👑 Full Access
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("finance")}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: 20,
                    backgroundColor: selectedSections.length === 4 && selectedSections.includes("payments") ? "#B89047" : "#FDF8ED",
                    color: selectedSections.length === 4 && selectedSections.includes("payments") ? "#FFFFFF" : "#78561A",
                    border: "1px solid #F0D9A4",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  💼 Finance Operator
                </button>
              </div>
            </div>

            {/* Modal Body: Checkboxes List */}
            <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {AVAILABLE_SECTIONS.map((sec) => {
                const isChecked = selectedSections.includes("all") || selectedSections.includes(sec.key);
                return (
                  <label
                    key={sec.key}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: isChecked ? "1.5px solid #0F4C3A" : "1px solid #E5E7EB",
                      backgroundColor: isChecked ? "#F9FCFA" : "#FFFFFF",
                      cursor: "pointer",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSection(sec.key)}
                      style={{ marginTop: 2, accentColor: "#0F4C3A", width: 16, height: 16, cursor: "pointer" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 15 }}>{sec.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#111418" }}>
                          {sec.title}
                        </span>
                        {sec.key === "ledger" && (
                          <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: "#EAF3EF", color: "#0F4C3A", padding: "1px 6px", borderRadius: 4 }}>
                            Mobile-First
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: "#6B7280", margin: "2px 0 0", lineHeight: 1.4 }}>
                        {sec.desc}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #E5E7EB", backgroundColor: "#F7F8FA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                {selectedSections.includes("all")
                  ? "User will have access to all 7 sections."
                  : `User will only see ${selectedSections.length} section${selectedSections.length === 1 ? "" : "s"}.`}
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setSectionModalUser(null)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #E5E7EB",
                    backgroundColor: "#FFFFFF",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleSaveSections}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 6,
                    backgroundColor: "#0F4C3A",
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    cursor: isPending ? "not-allowed" : "pointer",
                  }}
                >
                  {isPending ? "Saving…" : "Save Access Rights"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Direct Password Reset Modal */}
      {pwdModalUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(17, 20, 24, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            className="card"
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              maxWidth: 440,
              width: "100%",
              padding: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111418", margin: 0 }}>
              Update Password Directly
            </h2>
            <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4, marginBottom: 16 }}>
              Direct server update for <strong>{pwdModalUser.full_name || pwdModalUser.email}</strong>.
            </p>

            <form onSubmit={handleResetPassword}>
              <div className="field" style={{ marginBottom: 16 }}>
                <label className="field-label" style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 4 }}>
                  New Password (leave blank to auto-generate)
                </label>
                <input
                  type="text"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="e.g. PapaSecure2026!"
                  className="field-input"
                  style={{ minHeight: 40, fontSize: 13 }}
                />
                <span style={{ fontSize: 11, color: "#8A9099", marginTop: 4, display: "block" }}>
                  Minimum 6 characters if typing a specific password.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPwdModalUser(null)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #E5E7EB",
                    backgroundColor: "#FFFFFF",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 6,
                    backgroundColor: "#0F4C3A",
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    cursor: isPending ? "not-allowed" : "pointer",
                  }}
                >
                  {isPending ? "Updating…" : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Password Reset Success Modal */}
      {resetResult && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(17, 20, 24, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              maxWidth: 440,
              width: "100%",
              padding: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111418", margin: "0 0 8px" }}>
              Password Updated on Server
            </h2>
            <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 16px" }}>
              The password for <strong>{resetResult.email}</strong> is now updated:
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                border: "1px solid #C2E0D4",
                borderRadius: 8,
                backgroundColor: "#EAF3EF",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: "#0F4C3A" }}>
                {resetResult.password}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(resetResult.password, "reset_pwd")}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: "1px solid #C2E0D4",
                  backgroundColor: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#0F4C3A",
                  cursor: "pointer",
                }}
              >
                {copiedField === "reset_pwd" ? "Copied!" : "Copy"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setResetResult(null)}
              style={{
                width: "100%",
                height: 40,
                backgroundColor: "#0F4C3A",
                color: "#FFFFFF",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* 7. Staff List */}
      <div
        className="card"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #E5E7EB",
            backgroundColor: "#F7F8FA",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 500, color: "#8A9099" }}>
            User Account & Menu Rights
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#8A9099" }}>
            Actions & Role
          </span>
        </div>

        <div className="divide-y divide-[#E5E7EB]">
          {initialUsers.map((user) => {
            const isSelf = user.id === currentUserId;
            const isActive = user.is_active !== false;
            const sections = user.assigned_sections && user.assigned_sections.length > 0 ? user.assigned_sections : ["all"];
            const isLedgerOnly = sections.length === 1 && sections[0] === "ledger";
            const isFullAccess = sections.includes("all");

            return (
              <div
                key={user.id}
                style={{
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  opacity: isActive ? 1 : 0.6,
                }}
              >
                {/* Left: Name, Email, Date added, Menu Badges */}
                <div style={{ minWidth: 240, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#111418",
                        margin: 0,
                      }}
                    >
                      {user.full_name || "Staff Member"}
                    </p>
                    {isSelf && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: "#0F4C3A",
                          backgroundColor: "#EAF3EF",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        (you)
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#4B5563",
                      margin: "2px 0 0",
                    }}
                  >
                    {user.email}
                  </p>
                  
                  {/* Assigned Section Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {isLedgerOnly ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#0F4C3A",
                          backgroundColor: "#EAF3EF",
                          border: "1px solid #C2E0D4",
                          padding: "2px 8px",
                          borderRadius: 4,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        📱 Executive Ledger Only (Father / Mobile Dedicated)
                      </span>
                    ) : isFullAccess ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: "#374151",
                          backgroundColor: "#F3F4F6",
                          border: "1px solid #E5E7EB",
                          padding: "2px 8px",
                          borderRadius: 4,
                        }}
                      >
                        👑 Full Access (All 7 Sections)
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#92400E",
                          backgroundColor: "#FEF3C7",
                          border: "1px solid #FDE68A",
                          padding: "2px 8px",
                          borderRadius: 4,
                        }}
                      >
                        🎯 Custom Access ({sections.join(", ")})
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions (Menu Permissions, Password Reset, Role, Enable/Disable) */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                    flexWrap: "wrap",
                  }}
                >
                  {/* Menu Access Button */}
                  <button
                    type="button"
                    onClick={() => openSectionModal(user)}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #C2E0D4",
                      backgroundColor: "#EAF3EF",
                      color: "#0F4C3A",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    title="Configure which menu items this user sees"
                  >
                    <span>⚙️ Menu Access</span>
                  </button>

                  {/* Direct Password Reset Button */}
                  <button
                    type="button"
                    onClick={() => openPwdModal(user)}
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid #E5E7EB",
                      backgroundColor: "#FFFFFF",
                      color: "#374151",
                      cursor: "pointer",
                    }}
                    title="Change or reset password directly on server"
                  >
                    🔑 Password
                  </button>

                  {/* Role Dropdown */}
                  <select
                    value={user.role}
                    disabled={isSelf || isPending}
                    onChange={(e) =>
                      handleRoleChange(user.id, e.target.value as "admin" | "super_admin")
                    }
                    className="field-select"
                    style={{
                      fontSize: 12,
                      padding: "6px 24px 6px 10px",
                      minHeight: 32,
                      cursor: isSelf ? "not-allowed" : "pointer",
                      backgroundColor: isSelf ? "#F7F8FA" : "#FFFFFF",
                    }}
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>

                  {/* Enable/Disable Toggle */}
                  <button
                    type="button"
                    disabled={isSelf || isPending}
                    onClick={() => handleToggleActive(user.id, user.is_active)}
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: isSelf
                        ? "#8A9099"
                        : isActive
                        ? "#B91C1C"
                        : "#166534",
                      background: "none",
                      border: "none",
                      cursor: isSelf ? "not-allowed" : "pointer",
                      padding: "4px 8px",
                      textDecoration: isSelf ? "none" : "underline",
                    }}
                  >
                    {isActive ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
