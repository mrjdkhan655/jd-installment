import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard — Muhammad Wahab" };

const fmt = (n: number) =>
  "AED\u00A0" + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
  if (!profile) redirect("/login");

  const rawSections = user.user_metadata?.assigned_sections;
  const assignedSections: string[] =
    Array.isArray(rawSections) && rawSections.length > 0
      ? rawSections
      : ["all"];

  if (!assignedSections.includes("all") && !assignedSections.includes("overview")) {
    if (assignedSections.includes("ledger")) {
      redirect("/dashboard/ledger");
    } else if (assignedSections.includes("customers")) {
      redirect("/dashboard/customers");
    } else if (assignedSections.includes("contracts")) {
      redirect("/dashboard/contracts");
    } else if (assignedSections.includes("payments")) {
      redirect("/dashboard/payments");
    } else if (assignedSections.includes("documents")) {
      redirect("/dashboard/agreements");
    } else if (assignedSections.includes("administration")) {
      redirect("/dashboard/users");
    }
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString().slice(0, 10);

  const [
    { count: customerCount },
    { data: contracts },
    { data: officialPayments },
    { data: pendingPayments },
    { data: recentPayments },
    { data: upcomingInstallments },
    { data: monthSchedules },
  ] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase
      .from("contracts")
      .select(`
        id,
        contract_number,
        status,
        total_amount,
        down_payment,
        created_at,
        customers (
          id,
          customer_code,
          full_name,
          phone
        ),
        products (
          name,
          kind
        )
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("contract_id, amount, payment_date, reference_number, notes")
      .in("verification_status", ["not_required", "approved"]),
    supabase.from("payments").select("id, amount").eq("verification_status", "pending"),
    supabase
      .from("payments")
      .select("id, amount, payment_date, method, reference_number, verification_status, contracts(id, contract_number, customers(full_name))")
      .in("verification_status", ["not_required", "approved"])
      .order("payment_date", { ascending: false })
      .limit(6),
    supabase
      .from("installment_schedules")
      .select("id, due_date, expected_amount, status, contracts(id, contract_number, customers(full_name))")
      .in("status", ["upcoming", "pending", "partial"])
      .order("due_date", { ascending: true })
      .limit(6),
    supabase
      .from("installment_schedules")
      .select("expected_amount, status, due_date")
      .gte("due_date", startOfMonth)
      .lte("due_date", endOfMonth),
  ]);

  const activeContracts  = contracts?.filter((c) => c.status === "active").length ?? 0;
  const totalValue       = contracts?.reduce((s, c) => s + c.total_amount, 0) ?? 0;
  
  // Calculate total received across all contracts including advance down payment
  let totalReceived = 0;
  contracts?.forEach((c: any) => {
    const cPayments = (officialPayments ?? []).filter((p: any) => p.contract_id === c.id);
    const rawC = cPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const hasDp = cPayments.some(
      (p: any) => p.reference_number === "ADVANCE-DOWNPAYMENT" || (p.notes && p.notes.toLowerCase().includes("down payment"))
    );
    const dp = Number(c.down_payment) || 0;
    totalReceived += rawC + (hasDp ? 0 : dp);
  });
  const outstanding      = Math.max(0, totalValue - totalReceived);
  const pendingCount     = pendingPayments?.length ?? 0;
  const pendingTotal     = pendingPayments?.reduce((s, p) => s + p.amount, 0) ?? 0;

  const receivedThisMonth = officialPayments
    ?.filter((p) => {
      const d = new Date(p.payment_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, p) => s + p.amount, 0) ?? 0;

  const totalSchedulesThisMonth = monthSchedules?.reduce((s, item) => s + item.expected_amount, 0) ?? 0;
  const remainingInstThisMonth = monthSchedules?.filter((item) => item.status !== "paid").length ?? 0;

  // Expected this month is strictly the sum of installment schedules due in this calendar month
  const expectedThisMonth = totalSchedulesThisMonth;

  // Real collection rate based on actual schedule vs received
  const collectionRate = expectedThisMonth > 0
    ? Math.min(100, Math.round((receivedThisMonth / expectedThisMonth) * 100))
    : (receivedThisMonth > 0 ? 100 : 0);

  const expectedMeta = expectedThisMonth > 0
    ? (remainingInstThisMonth > 0 ? `${remainingInstThisMonth} installment${remainingInstThisMonth === 1 ? "" : "s"} remaining` : "All installments received")
    : (receivedThisMonth > 0 ? "Advance payments received" : "No installments scheduled");

  const collectedMeta = expectedThisMonth > 0
    ? `${collectionRate}% collection rate`
    : (receivedThisMonth > 0 ? "Advance collection" : "0% collection rate");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="fade-in">
      {/* Section Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#111827", lineHeight: 1.2 }}>
            Financial Overview
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
            High-trust installment ledger and portfolio liquidity monitoring.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href="/dashboard/contracts/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-md transition-colors"
            style={{ backgroundColor: "var(--primary)", minHeight: 40 }}
          >
            + New Contract
          </Link>
        </div>
      </div>

      {/* Financial Notification Strip (Conditional — Section 3.1) */}
      {pendingCount > 0 && (
        <div
          style={{
            background: "var(--status-pending-bg)",
            border: "1px solid var(--status-pending-border)",
            borderRadius: "var(--radius-md)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--status-pending-text)" }}>
            {pendingCount} customer-submitted payment{pendingCount !== 1 ? "s" : ""} awaiting verification ({fmt(pendingTotal)}).
          </div>
          <Link
            href="/dashboard/payments/verification"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#FFFFFF",
              backgroundColor: "var(--status-pending-text)",
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            Review submissions →
          </Link>
        </div>
      )}

      {/* KPI Matrix (4 Columns Desktop, 2 Columns Mobile — Section 3.1) */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Outstanding Capital</div>
          <div className="kpi-value">{fmt(outstanding)}</div>
          <div className="kpi-meta">{activeContracts} active contracts</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Due This Month</div>
          <div className="kpi-value">{fmt(expectedThisMonth)}</div>
          <div className="kpi-meta">{expectedMeta}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Collected This Month</div>
          <div className="kpi-value" style={{ color: "var(--status-paid-text)" }}>{fmt(receivedThisMonth)}</div>
          <div className="kpi-meta">{collectedMeta}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pending Verification</div>
          <div className="kpi-value" style={pendingCount > 0 ? { color: "var(--status-pending-text)" } : undefined}>
            {fmt(pendingTotal)}
          </div>
          <div className={`kpi-meta ${pendingCount > 0 ? "pending" : ""}`}>
            {pendingCount > 0 ? `${pendingCount} records unverified` : "All submissions audited"}
          </div>
        </div>
      </div>

      {/* Customer Portfolio Balances Strip (Replaces 3D Canvas / Chart with Live Accounting Table) */}
      <div
        className="card"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          padding: "20px 24px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
                Customer Accounts & Installment Balances
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: "var(--primary-tint)",
                  color: "var(--primary)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                {contracts?.length ?? 0} Accounts
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>
              Live ledger summary: approved payments are automatically deducted from the total capital to display real-time remaining balances.
            </p>
          </div>

          <Link
            href="/dashboard/contracts"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--primary)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            All Contracts →
          </Link>
        </div>

        {(!contracts || contracts.length === 0) ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#6B7280", fontSize: 13 }}>
            No customer accounts recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", fontSize: 13, textAlign: "left", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-default)", color: "#6B7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  <th style={{ padding: "10px 12px", fontWeight: 600 }}>Customer / User</th>
                  <th style={{ padding: "10px 12px", fontWeight: 600 }}>Asset / Agreement</th>
                  <th style={{ padding: "10px 12px", fontWeight: 600, textAlign: "right" }}>Total Amount</th>
                  <th style={{ padding: "10px 12px", fontWeight: 600, textAlign: "right" }}>Paid (Verified)</th>
                  <th style={{ padding: "10px 12px", fontWeight: 600, textAlign: "right" }}>Remaining Balance</th>
                  <th style={{ padding: "10px 12px", fontWeight: 600, textAlign: "center" }}>Status</th>
                  <th style={{ padding: "10px 12px", fontWeight: 600, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c: any) => {
                  const customer = c.customers;
                  const product = c.products;
                  const dp = Number(c.down_payment) || 0;
                  const rawPaid = (officialPayments ?? [])
                    .filter((p: any) => p.contract_id === c.id)
                    .reduce((sum: number, p: any) => sum + p.amount, 0);
                  const hasDpInPayments = (officialPayments ?? []).some(
                    (p: any) => p.contract_id === c.id && (p.reference_number === "ADVANCE-DOWNPAYMENT" || (p.notes && p.notes.toLowerCase().includes("down payment")))
                  );
                  const paid = rawPaid + (hasDpInPayments ? 0 : dp);
                  const remaining = Math.max(0, c.total_amount - paid);

                  const paidFraction = c.total_amount > 0 ? (paid / c.total_amount) * 100 : 0;
                  const remainingFraction = Math.max(0, 100 - paidFraction);
                  const paidPctFormatted = paidFraction === 0 ? "0%" : paidFraction < 1 ? `${paidFraction.toFixed(1)}%` : Number.isInteger(paidFraction) ? `${paidFraction}%` : `${paidFraction.toFixed(1)}%`;
                  const remainingPctFormatted = remainingFraction === 100 ? "100%" : remainingFraction > 99 ? `${remainingFraction.toFixed(1)}%` : Number.isInteger(remainingFraction) ? `${remainingFraction}%` : `${remainingFraction.toFixed(1)}%`;
                  const progressLineWidth = paid > 0 ? Math.max(2, Math.min(100, paidFraction)) : 0;

                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border-default)" }} className="hover-row">
                      <td style={{ padding: "12px" }}>
                        <div style={{ fontWeight: 600, color: "#111827" }}>
                          {customer?.full_name ?? "Customer"}
                        </div>
                        <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "monospace", marginTop: 2 }}>
                          {customer?.customer_code ?? "—"}
                        </div>
                      </td>

                      <td style={{ padding: "12px" }}>
                        <div style={{ fontWeight: 500, color: "#111827" }}>
                          {product?.name || "Asset"}
                        </div>
                        <div style={{ fontSize: 11, color: "#0F4C3A", fontFamily: "monospace", marginTop: 2 }}>
                          #{c.contract_number}
                        </div>
                      </td>

                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 600, color: "#111827" }} className="tabular-nums">
                        {fmt(c.total_amount)}
                      </td>

                      <td style={{ padding: "12px", textAlign: "right" }} className="tabular-nums">
                        <div style={{ fontWeight: 600, color: "var(--status-paid-text)" }}>
                          {fmt(paid)}
                        </div>
                        {dp > 0 && (
                          <div style={{ fontSize: 10, color: "#166534", marginTop: 1, fontWeight: 500 }}>
                            Includes {fmt(dp)} Advance
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <div style={{ fontWeight: 700, color: remaining === 0 ? "var(--status-paid-text)" : "#0F4C3A" }} className="tabular-nums">
                          {fmt(remaining)}
                        </div>
                        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                          {remainingPctFormatted} remaining ({paidPctFormatted} paid)
                        </div>
                        <div style={{ height: 4, width: 110, backgroundColor: "#E5E7EB", borderRadius: 2, overflow: "hidden", marginLeft: "auto", marginTop: 4 }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${progressLineWidth}%`,
                              backgroundColor: "#0F4C3A",
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                      </td>

                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <span className={`badge badge-${c.status}`}>
                          {c.status.toUpperCase()}
                        </span>
                      </td>

                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <Link
                          href={`/dashboard/contracts/${c.id}`}
                          className="btn-secondary"
                          style={{
                            padding: "6px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 6,
                            textDecoration: "none",
                            border: "1px solid var(--border-default)",
                            backgroundColor: "#FFFFFF",
                            color: "#111827",
                            display: "inline-block",
                          }}
                        >
                          View Ledger
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dual Table Balance Display (60% / 40% Desktop Split — Section 3.1) */}
      <div style={{ display: "grid", gap: 24 }} className="grid-cols-1 lg:grid-cols-12">
        {/* Left Column (60%): Upcoming Due Dates */}
        <div
          className="lg:col-span-7 card"
          style={{
            padding: 0,
            overflow: "hidden",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border-default)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>
                Upcoming Due Dates (Next 7 Calendar Days)
              </h2>
              <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0" }}>
                Active receivables requiring collections follow-up.
              </p>
            </div>
            <Link
              href="/dashboard/installments"
              style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none", fontWeight: 500 }}
            >
              View all installments →
            </Link>
          </div>

          {!upcomingInstallments || upcomingInstallments.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#6B7280" }}>No upcoming payments due in the immediate cycle.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-default)" }}>
                    <th style={{ padding: "10px 16px", color: "#6B7280", fontWeight: 500, fontSize: 11 }}>Due Date</th>
                    <th style={{ padding: "10px 16px", color: "#6B7280", fontWeight: 500, fontSize: 11 }}>Customer Name</th>
                    <th style={{ padding: "10px 16px", color: "#6B7280", fontWeight: 500, fontSize: 11 }}>Contract Ref</th>
                    <th style={{ padding: "10px 16px", color: "#6B7280", fontWeight: 500, fontSize: 11, textAlign: "right" }}>Amount Due</th>
                    <th style={{ padding: "10px 16px", color: "#6B7280", fontWeight: 500, fontSize: 11, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingInstallments.map((inst) => {
                    const c = inst.contracts as unknown as { id: string; contract_number: string; customers: { full_name: string } | null } | null;
                    const days = Math.ceil((new Date(inst.due_date).getTime() - Date.now()) / 86400000);
                    const isOverdue = days < 0;

                    return (
                      <tr
                        key={inst.id}
                        style={{ borderBottom: "1px solid var(--border-default)" }}
                        className="hover:bg-[#F7F8FA]"
                      >
                        <td style={{ padding: "12px 16px" }}>
                          <span className="tabular-nums" style={{ fontWeight: 500, color: isOverdue ? "var(--status-overdue-text)" : "#111827" }}>
                            {new Date(inst.due_date).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          <span style={{ display: "block", fontSize: 10, color: isOverdue ? "var(--status-overdue-text)" : "#6B7280" }}>
                            {isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `In ${days} days`}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 500, color: "#111827" }}>
                          {c?.customers?.full_name ?? "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span className="font-mono text-xs text-gray-500">
                            {c?.contract_number ?? "—"}
                          </span>
                        </td>
                        <td className="numeric-cell tabular-nums" style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#111827" }}>
                          {fmt(inst.expected_amount)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <Link
                            href={`/dashboard/contracts/${c?.id || ""}`}
                            className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                          >
                            Record
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column (40%): Recent Transactions */}
        <div
          className="lg:col-span-5 card"
          style={{
            padding: 0,
            overflow: "hidden",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border-default)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>
                Recent Transactions
              </h2>
              <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0" }}>
                Audited and credited receipts in active ledger.
              </p>
            </div>
            <Link
              href="/dashboard/payments"
              style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none", fontWeight: 500 }}
            >
              Cash book →
            </Link>
          </div>

          {!recentPayments || recentPayments.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#6B7280" }}>No payment receipts recorded yet.</p>
            </div>
          ) : (
            <div>
              {recentPayments.map((p) => {
                const c = p.contracts as unknown as { id: string; contract_number: string; customers: { full_name: string } | null } | null;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 18px",
                      borderBottom: "1px solid var(--border-default)",
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c?.customers?.full_name ?? "Client"}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: "var(--status-paid-text)",
                            backgroundColor: "var(--status-paid-bg)",
                            border: "1px solid var(--status-paid-border)",
                            padding: "1px 6px",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          Verified
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                        {new Date(p.payment_date).toLocaleDateString("en-AE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {p.reference_number ? ` · ${p.reference_number}` : ""}
                      </p>
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: "var(--status-paid-text)" }}>
                        +{fmt(p.amount)}
                      </span>
                      <span style={{ display: "block", fontSize: 10, color: "#6B7280" }}>
                        Ledger Credited
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
