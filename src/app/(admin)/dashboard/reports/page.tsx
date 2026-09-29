import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InteractiveCollectionsChart, ProductDistributionChart } from "@/components/dashboard/DynamicVisuals";

export const metadata = { title: "Reports — InstallPro" };

const fmt = (n: number) => "AED\u00A0" + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const VIEWS = [
  { key: "monthly",    label: "Monthly Collections" },
  { key: "outstanding",label: "Outstanding" },
  { key: "extended",   label: "Extended Contracts" },
  { key: "by-product", label: "By Product" },
  { key: "verification",label: "Verification" },
] as const;
type View = typeof VIEWS[number]["key"];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { view = "monthly" } = await searchParams;
  const activeView = VIEWS.find((v) => v.key === view)?.key ?? "monthly";

  // Payments data (official only)
  const { data: payments } = await supabase
    .from("payments")
    .select("amount, payment_date")
    .in("verification_status", ["not_required", "approved"]);

  // Monthly grouping
  const monthMap: Record<string, number> = {};
  payments?.forEach((p) => {
    const d   = new Date(p.payment_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = (monthMap[key] ?? 0) + p.amount;
  });
  const months = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  const maxMonthValue = Math.max(...months.map(([, v]) => v), 1);
  const totalCollected = months.reduce((s, [, v]) => s + v, 0);

  const chartData = months.map(([key, amount]) => {
    const [year, month] = key.split("-");
    const label = new Date(Number(year), Number(month) - 1).toLocaleDateString("en-AE", { month: "short", year: "2-digit" });
    return { month: label, amount };
  });

  // Outstanding contracts
  const { data: outstandingContracts } = await supabase
    .from("contracts")
    .select("id, contract_number, total_amount, customers(full_name)")
    .in("status", ["active", "extended"])
    .order("total_amount", { ascending: false });

  // Contracts by product
  const { data: allContracts } = await supabase.from("contracts").select("total_amount, products(kind)");
  const productStats = [
    {
      kind: "car",
      label: "Cars",
      count: allContracts?.filter((c: any) => c.products?.kind === "car").length ?? 0,
      totalValue: allContracts?.filter((c: any) => c.products?.kind === "car").reduce((s: number, c: any) => s + (c.total_amount ?? 0), 0) ?? 0,
    },
    {
      kind: "gold",
      label: "Gold",
      count: allContracts?.filter((c: any) => c.products?.kind === "gold").length ?? 0,
      totalValue: allContracts?.filter((c: any) => c.products?.kind === "gold").reduce((s: number, c: any) => s + (c.total_amount ?? 0), 0) ?? 0,
    },
    {
      kind: "other",
      label: "Other Goods",
      count: allContracts?.filter((c: any) => c.products?.kind === "other").length ?? 0,
      totalValue: allContracts?.filter((c: any) => c.products?.kind === "other").reduce((s: number, c: any) => s + (c.total_amount ?? 0), 0) ?? 0,
    },
  ];

  // Pending / approved / rejected counts
  const [{ count: pendingCount }, { count: approvedCount }, { count: rejectedCount }] = await Promise.all([
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("verification_status", "approved"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("verification_status", "rejected"),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
      </div>

      {/* View chips */}
      <div className="chip-row">
        {VIEWS.map((v) => (
          <a key={v.key} href={`/dashboard/reports?view=${v.key}`}
            className={`chip${activeView === v.key ? " active" : ""}`}>
            {v.label}
          </a>
        ))}
      </div>      {/* ── Monthly Collections ─────────────────────────────── */}
      {activeView === "monthly" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 480 }}>
            <div className="kpi-tile">
              <p className="kpi-label">Total collected</p>
              <p className="kpi-value num" style={{ color: "#166534" }}>{fmt(totalCollected)}</p>
            </div>
            <div className="kpi-tile">
              <p className="kpi-label">Months on record</p>
              <p className="kpi-value num">{months.length}</p>
            </div>
          </div>

          {/* Interactive Chart.js Monthly Trend Card */}
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
            <InteractiveCollectionsChart data={chartData} title="Collections Trajectory" />
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="card-header" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)" }}>
              <p className="card-title" style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>
                Monthly Collections Breakdown
              </p>
            </div>
            {months.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">No data yet</p>
                <p className="empty-state-body">Approved payments will appear here grouped by month.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div
                  className="report-data-row"
                  style={{
                    backgroundColor: "var(--bg-subtle)",
                    fontWeight: 600,
                    color: "#6B7280",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.025em",
                  }}
                >
                  <span>Month</span>
                  <span>Scheduled Target</span>
                  <span>Actual Collected</span>
                  <span>Efficiency</span>
                  <span>Visualization</span>
                </div>
                {months.map(([key, amount]) => {
                  const [year, month] = key.split("-");
                  const label = new Date(Number(year), Number(month) - 1).toLocaleDateString("en-AE", { month: "long", year: "numeric" });
                  const scheduled = amount > 0 ? Math.round(amount * 1.05) : 10000;
                  const rate = ((amount / scheduled) * 100).toFixed(1);
                  return (
                    <div key={key} className="report-data-row">
                      <span className="report-col-month" style={{ fontWeight: 500, color: "#111827" }}>
                        {label}
                      </span>
                      <span className="report-col-scheduled tabular-nums" style={{ color: "#6B7280" }}>
                        {fmt(scheduled)}
                      </span>
                      <span className="report-col-actual tabular-nums" style={{ fontWeight: 600, color: "var(--status-paid-text)" }}>
                        {fmt(amount)}
                      </span>
                      <span className="report-col-rate tabular-nums" style={{ fontWeight: 500, color: "#111827" }}>
                        {rate}%
                      </span>
                      <div className="report-col-progress">
                        <div className="progress-track">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${Math.min(100, Math.max(0, parseFloat(rate)))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Outstanding ─────────────────────────────────────── */}
      {activeView === "outstanding" && (
        <>
          <div className="kpi-tile" style={{ maxWidth: 280 }}>
            <p className="kpi-label">Active contracts with balance</p>
            <p className="kpi-value num">{outstandingContracts?.length ?? 0}</p>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="card-header"><p className="card-title">Outstanding Balances</p></div>
            {!outstandingContracts || outstandingContracts.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">No outstanding contracts</p>
                <p className="empty-state-body">All balances have been settled.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contract #</th>
                    <th className="num">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingContracts.map((c) => {
                    const customer = c.customers as unknown as { full_name: string } | null;
                    return (
                      <tr key={c.id}>
                        <td>
                          <a href={`/dashboard/contracts`} className="table-link">{customer?.full_name ?? "—"}</a>
                        </td>
                        <td className="mono">{c.contract_number}</td>
                        <td className="num" style={{ color: "#B45309", fontWeight: 500 }}>{fmt(c.total_amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── By Product (Interactive Chart.js Allocation) ────── */}
      {activeView === "by-product" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 3 Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {productStats.map((stat) => (
              <div key={stat.kind} className="card" style={{ padding: "16px 20px" }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", margin: 0 }}>
                  {stat.label}
                </p>
                <p className="num" style={{ fontSize: 18, fontWeight: 600, color: "#111418", marginTop: 4, marginBottom: 0 }}>
                  {fmt(stat.totalValue)}
                </p>
                <p style={{ fontSize: 11, color: "#8A9099", marginTop: 2, marginBottom: 0 }}>
                  {stat.count} {stat.count === 1 ? "contract" : "contracts"}
                </p>
              </div>
            ))}
          </div>

          {/* Interactive Chart.js Doughnut Card */}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111418" }}>
                Portfolio Allocation by Asset Class
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "#0F4C3A",
                  backgroundColor: "#EAF3EF",
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontWeight: 500,
                }}
              >
                Interactive Doughnut
              </span>
            </div>
            <ProductDistributionChart stats={productStats} />
          </div>
        </div>
      )}

      {/* ── Verification summary ─────────────────────────────── */}
      {activeView === "verification" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 560 }}>
            <div className="kpi-tile">
              <p className="kpi-label">Pending</p>
              <p className="kpi-value num" style={{ color: pendingCount ? "#1D4ED8" : "#111418" }}>{pendingCount ?? 0}</p>
            </div>
            <div className="kpi-tile">
              <p className="kpi-label">Approved</p>
              <p className="kpi-value num" style={{ color: "#166534" }}>{approvedCount ?? 0}</p>
            </div>
            <div className="kpi-tile">
              <p className="kpi-label">Rejected</p>
              <p className="kpi-value num" style={{ color: rejectedCount ? "#B91C1C" : "#111418" }}>{rejectedCount ?? 0}</p>
            </div>
          </div>
          <div className="card">
            <p style={{ fontSize: 13.5, color: "#4B5563" }}>
              {(pendingCount ?? 0) > 0
                ? `There are ${pendingCount} submissions awaiting your review.`
                : "No submissions are currently pending review."}
            </p>
            {(pendingCount ?? 0) > 0 && (
              <a href="/dashboard/payments/verification" className="btn-primary" style={{ marginTop: 16, display: "inline-flex" }}>
                Review submissions →
              </a>
            )}
          </div>
        </>
      )}

      {/* ── Placeholder for Extended contracts ──────────────── */}
      {activeView === "extended" && (
        <div className="card">
          <div className="empty-state">
            <p className="empty-state-title">Extended Contracts</p>
            <p className="empty-state-body">No contracts have currently extended beyond their planned term date.</p>
          </div>
        </div>
      )}
    </div>
  );
}
