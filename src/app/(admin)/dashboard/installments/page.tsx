import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Installments — InstallPro" };

const fmt = (n: number) =>
  "AED\u00A0" +
  n.toLocaleString("en-AE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

interface CustomerSummary {
  id: string;
  name: string;
  code: string;
  phone: string;
  contracts: Array<{ id: string; contract_number: string }>;
  totalAgreed: number;
  totalPaid: number;
  totalRemaining: number;
  remainingPct: number;
  paidPct: number;
  installmentsCount: number;
  upcomingCount: number;
  overdueCount: number;
  partialCount: number;
  paidCount: number;
}

export default async function InstallmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; customer?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const resolvedParams = await searchParams;
  const customerParam = resolvedParams.customer;
  const currentView = (resolvedParams.view || "upcoming").toLowerCase();

  // Fetch all installments with contract & customer details
  const { data: allInstallments } = await supabase
    .from("installment_schedules")
    .select(
      `
      id,
      installment_number,
      due_date,
      expected_amount,
      status,
      is_final_balance,
      notes,
      contract_id,
      contracts (
        id,
        contract_number,
        status,
        total_amount,
        down_payment,
        customers (
          id,
          customer_code,
          full_name,
          phone
        )
      )
    `
    )
    .order("due_date", { ascending: true });

  // Fetch all approved/not_required payments to calculate paid per installment and contract
  const { data: payments } = await supabase
    .from("payments")
    .select("contract_id, installment_id, amount, verification_status, reference_number, notes")
    .in("verification_status", ["not_required", "approved"]);

  const paidMap = new Map<string, number>();
  const contractPaidMap = new Map<string, number>();
  (payments ?? []).forEach((p) => {
    const amt = Number(p.amount) || 0;
    if (p.installment_id) {
      paidMap.set(
        p.installment_id,
        (paidMap.get(p.installment_id) ?? 0) + amt
      );
    }
    if (p.contract_id) {
      contractPaidMap.set(
        p.contract_id,
        (contractPaidMap.get(p.contract_id) ?? 0) + amt
      );
    }
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Categorize and compute derived statuses
  const processed = (allInstallments ?? []).map((inst) => {
    const paid = paidMap.get(inst.id) ?? 0;
    const remaining = Math.max(0, inst.expected_amount - paid);
    const dueDate = new Date(inst.due_date);
    const isPastDue = dueDate.getTime() < now.getTime();

    let computedStatus: "paid" | "overdue" | "partial" | "upcoming" = "upcoming";
    if (remaining === 0) {
      computedStatus = "paid";
    } else if (isPastDue) {
      computedStatus = "overdue";
    } else if (paid > 0) {
      computedStatus = "partial";
    } else {
      computedStatus = "upcoming";
    }

    return {
      ...inst,
      paid,
      remaining,
      computedStatus,
    };
  });

  // Group by customer
  const customerMap = new Map<string, any>();
  const seenContracts = new Set<string>();

  processed.forEach((inst) => {
    const contract = inst.contracts as any;
    const cust = contract?.customers;
    if (!cust || !cust.id) return;

    if (!customerMap.has(cust.id)) {
      customerMap.set(cust.id, {
        id: cust.id,
        name: cust.full_name || "Customer",
        code: cust.customer_code || "—",
        phone: cust.phone || "—",
        contracts: [],
        totalAgreed: 0,
        totalPaid: 0,
        totalDownPayment: 0,
        totalRemaining: 0,
        installmentsCount: 0,
        upcomingCount: 0,
        overdueCount: 0,
        partialCount: 0,
        paidCount: 0,
      });
    }

    const cEntry = customerMap.get(cust.id)!;
    cEntry.installmentsCount += 1;

    if (inst.computedStatus === "upcoming") cEntry.upcomingCount += 1;
    if (inst.computedStatus === "overdue") cEntry.overdueCount += 1;
    if (inst.computedStatus === "partial") cEntry.partialCount += 1;
    if (inst.computedStatus === "paid") cEntry.paidCount += 1;

    if (contract?.id && !seenContracts.has(contract.id)) {
      seenContracts.add(contract.id);
      const cTotal = Number(contract.total_amount) || 0;
      const cDp = Number(contract.down_payment) || 0;
      const cPaid = contractPaidMap.get(contract.id) ?? 0;
      const hasDpRecorded = (payments ?? []).some(
        (p) => p.contract_id === contract.id && (p.reference_number === "ADVANCE-DOWNPAYMENT" || (p.notes && p.notes.toLowerCase().includes("down payment")))
      );
      const effectiveCPaid = cPaid + (hasDpRecorded ? 0 : cDp);

      cEntry.totalAgreed += cTotal;
      cEntry.totalDownPayment += cDp;
      cEntry.totalPaid += effectiveCPaid;

      cEntry.contracts.push({
        id: contract.id,
        contract_number: contract.contract_number,
        total_amount: cTotal,
        down_payment: cDp,
      });
    }
  });

  const customerList = Array.from(customerMap.values()).map((c) => {
    c.totalRemaining = Math.max(0, c.totalAgreed - c.totalPaid);
    const paidFraction = c.totalAgreed > 0 ? (c.totalPaid / c.totalAgreed) * 100 : 0;
    const remainingFraction = Math.max(0, 100 - paidFraction);
    const paidPctFormatted = paidFraction === 0 ? "0%" : paidFraction < 1 ? `${paidFraction.toFixed(1)}%` : Number.isInteger(paidFraction) ? `${paidFraction}%` : `${paidFraction.toFixed(1)}%`;
    const remainingPctFormatted = remainingFraction === 100 ? "100%" : remainingFraction > 99 ? `${remainingFraction.toFixed(1)}%` : Number.isInteger(remainingFraction) ? `${remainingFraction}%` : `${remainingFraction.toFixed(1)}%`;
    const progressLineWidth = c.totalPaid > 0 ? Math.max(2, Math.min(100, paidFraction)) : 0;

    return {
      ...c,
      paidFraction,
      remainingFraction,
      paidPctFormatted,
      remainingPctFormatted,
      progressLineWidth,
    };
  });

  // Global ledger totals
  const overallAgreed = customerList.reduce((s, c) => s + c.totalAgreed, 0);
  const overallPaid = customerList.reduce((s, c) => s + c.totalPaid, 0);
  const overallRemaining = Math.max(0, overallAgreed - overallPaid);

  const overallPaidFraction = overallAgreed > 0 ? (overallPaid / overallAgreed) * 100 : 0;
  const overallRemainingFraction = Math.max(0, 100 - overallPaidFraction);
  const overallPaidPctFormatted = overallPaidFraction === 0 ? "0%" : overallPaidFraction < 1 ? `${overallPaidFraction.toFixed(1)}%` : Number.isInteger(overallPaidFraction) ? `${overallPaidFraction}%` : `${overallPaidFraction.toFixed(1)}%`;
  const overallRemainingPctFormatted = overallRemainingFraction === 100 ? "100%" : overallRemainingFraction > 99 ? `${overallRemainingFraction.toFixed(1)}%` : Number.isInteger(overallRemainingFraction) ? `${overallRemainingFraction}%` : `${overallRemainingFraction.toFixed(1)}%`;

  // Check if a customer is selected
  const isAllSelected = customerParam === "all";
  const selectedCustomer = customerParam && !isAllSelected
    ? customerList.find((c) => c.id === customerParam) || null
    : null;

  // If NO customer is selected, show Customer Directory View
  if (!customerParam) {
    return (
      <div
        style={{
          padding: "24px",
          maxWidth: 1152,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#111418",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              Installment Schedules
            </h1>
            <p style={{ fontSize: 13, color: "#4B5563", marginTop: 4, marginBottom: 0 }}>
              Select a customer below to view their active installment plan, repayment progress, and rollover balances.
            </p>
          </div>

          <Link
            href="/dashboard/installments?customer=all&view=upcoming"
            className="btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              backgroundColor: "#FFFFFF",
              border: "1px solid #D1D5DB",
              color: "#374151",
            }}
          >
            View All Installments Combined →
          </Link>
        </div>

        {/* Global Summary KPI Tiles */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div
            className="card"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              padding: "16px 20px",
              boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", margin: 0 }}>
              Active Customers
            </p>
            <p className="num" style={{ fontSize: 20, fontWeight: 600, color: "#111418", marginTop: 6, marginBottom: 0 }}>
              {customerList.length} {customerList.length === 1 ? "Customer" : "Customers"}
            </p>
            <p style={{ fontSize: 11, color: "#8A9099", margin: "4px 0 0" }}>
              In active installment agreements
            </p>
          </div>

          <div
            className="card"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              padding: "16px 20px",
              boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", margin: 0 }}>
              Paid Amount
            </p>
            <p className="num" style={{ fontSize: 20, fontWeight: 600, color: "#166534", marginTop: 6, marginBottom: 0 }}>
              {fmt(overallPaid)}
            </p>
            <p style={{ fontSize: 11, color: "#8A9099", margin: "4px 0 0" }}>
              Verified collections received
            </p>
          </div>

          <div
            className="card"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              padding: "16px 20px",
              boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", margin: 0 }}>
              Remaining Balance
            </p>
            <p className="num" style={{ fontSize: 20, fontWeight: 600, color: "#0F4C3A", marginTop: 6, marginBottom: 0 }}>
              {fmt(overallRemaining)}
            </p>
            <p style={{ fontSize: 11, color: "#0F4C3A", fontWeight: 600, margin: "4px 0 0" }}>
              {overallRemainingPctFormatted} remaining ({overallPaidPctFormatted} paid)
            </p>
          </div>
        </div>

        {/* Customer Accounts Directory List */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
              Customer Accounts ({customerList.length})
            </h2>
            <span style={{ fontSize: 12, color: "#6B7280" }}>
              Click any customer to open their schedule
            </span>
          </div>

          {customerList.length === 0 ? (
            <div
              className="card"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: "48px 24px",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 500, color: "#4B5563", margin: 0 }}>
                No active installment schedules found.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
              {customerList.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/installments?customer=${c.id}&view=upcoming`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    className="card hover-row"
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E7EB",
                      borderRadius: 8,
                      padding: "18px 20px",
                      boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                      transition: "all 0.15s ease",
                      cursor: "pointer",
                    }}
                  >
                    {/* Customer Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
                          {c.name}
                        </h3>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6B7280" }}>
                            {c.code}
                          </span>
                          {c.phone && (
                            <>
                              <span style={{ color: "#D1D5DB" }}>·</span>
                              <span style={{ fontSize: 11, color: "#6B7280" }}>{c.phone}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 12,
                          backgroundColor: "#EAF3EF",
                          color: "#0F4C3A",
                          border: "1px solid #A7D5C5",
                        }}
                      >
                        {c.contracts.length} {c.contracts.length === 1 ? "Agreement" : "Agreements"}
                      </span>
                    </div>

                    {/* Financial Metrics Strip */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 8,
                        padding: "10px 12px",
                        backgroundColor: "#F9FAFB",
                        borderRadius: 6,
                        border: "1px solid #F3F4F6",
                        textAlign: "center",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 10, color: "#6B7280", display: "block", textTransform: "uppercase" }}>Total Agreed</span>
                        <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: "#111827", display: "block", marginTop: 2 }}>
                          {fmt(c.totalAgreed)}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: "#166534", display: "block", textTransform: "uppercase", fontWeight: 600 }}>Paid</span>
                        <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: "#166534", display: "block", marginTop: 2 }}>
                          {fmt(c.totalPaid)}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: "#0F4C3A", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Remaining</span>
                        <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 800, color: "#0F4C3A", display: "block", marginTop: 2 }}>
                          {fmt(c.totalRemaining)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar with Remaining % */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
                        <span style={{ color: "#6B7280" }}>Repayment Progress</span>
                        <span style={{ fontWeight: 600, color: "#0F4C3A" }}>
                          {c.remainingPct}% remaining ({c.paidPct}% paid)
                        </span>
                      </div>
                      <div style={{ height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${c.paidPct}%`,
                            backgroundColor: "#0F4C3A",
                          }}
                        />
                      </div>
                    </div>

                    {/* Schedule Counts & Action */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #F3F4F6" }}>
                      <div style={{ display: "flex", gap: 6, fontSize: 11 }}>
                        <span style={{ color: "#166534", fontWeight: 500 }}>{c.paidCount} Paid</span>
                        <span style={{ color: "#D1D5DB" }}>·</span>
                        <span style={{ color: "#4B5563" }}>{c.upcomingCount} Upcoming</span>
                        {c.overdueCount > 0 && (
                          <>
                            <span style={{ color: "#D1D5DB" }}>·</span>
                            <span style={{ color: "#B91C1C", fontWeight: 600 }}>{c.overdueCount} Overdue</span>
                          </>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#0F4C3A",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        Open Schedule →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- CUSTOMER SELECTED (OR ALL) VIEW ---
  const customerInstallments = isAllSelected
    ? processed
    : processed.filter((inst) => (inst.contracts as any)?.customers?.id === customerParam);

  // Filter based on view chip
  const filtered = customerInstallments.filter((item) => {
    if (currentView === "all") return true;
    return item.computedStatus === currentView;
  });

  // Calculate totals for KPI tiles
  const totalCount = filtered.length;
  const totalPaid = filtered.reduce((s, i) => s + i.paid, 0);
  const totalRemaining = filtered.reduce((s, i) => s + i.remaining, 0);

  const custOverallAgreed = selectedCustomer ? selectedCustomer.totalAgreed : overallAgreed;
  const custOverallPaid = selectedCustomer ? selectedCustomer.totalPaid : overallPaid;
  const custOverallRemaining = selectedCustomer ? selectedCustomer.totalRemaining : overallRemaining;
  const custOverallDownPayment = selectedCustomer ? selectedCustomer.totalDownPayment : 0;

  const custPaidPctFormatted = selectedCustomer ? selectedCustomer.paidPctFormatted : overallPaidPctFormatted;
  const custRemainingPctFormatted = selectedCustomer ? selectedCustomer.remainingPctFormatted : overallRemainingPctFormatted;
  const custProgressLineWidth = selectedCustomer
    ? selectedCustomer.progressLineWidth
    : (overallPaid > 0 ? Math.max(2, Math.min(100, overallPaidFraction)) : 0);

  const chips = [
    { id: "upcoming", label: "Upcoming" },
    { id: "overdue", label: "Overdue" },
    { id: "partial", label: "Partial" },
    { id: "paid", label: "Paid" },
    { id: "all", label: "All" },
  ];

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: 1152,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Top Navigation: Return to Customers List + Switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <Link
          href="/dashboard/installments"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "#0F4C3A",
            textDecoration: "none",
            backgroundColor: "#EAF3EF",
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #A7D5C5",
          }}
        >
          ← Back to Customer Directory
        </Link>

        {/* Quick Customer Switcher Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto" }}>
          <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 500, marginRight: 2 }}>Switch Customer:</span>
          {customerList.map((c) => {
            const isCur = c.id === customerParam;
            return (
              <Link
                key={c.id}
                href={`/dashboard/installments?customer=${c.id}&view=${currentView}`}
                style={{
                  fontSize: 11,
                  fontWeight: isCur ? 700 : 500,
                  padding: "4px 10px",
                  borderRadius: 12,
                  textDecoration: "none",
                  backgroundColor: isCur ? "#0F4C3A" : "#FFFFFF",
                  color: isCur ? "#FFFFFF" : "#4B5563",
                  border: `1px solid ${isCur ? "#0F4C3A" : "#E5E7EB"}`,
                  whiteSpace: "nowrap",
                }}
              >
                {c.name}
              </Link>
            );
          })}
          <Link
            href={`/dashboard/installments?customer=all&view=${currentView}`}
            style={{
              fontSize: 11,
              fontWeight: isAllSelected ? 700 : 500,
              padding: "4px 10px",
              borderRadius: 12,
              textDecoration: "none",
              backgroundColor: isAllSelected ? "#0F4C3A" : "#FFFFFF",
              color: isAllSelected ? "#FFFFFF" : "#4B5563",
              border: `1px solid ${isAllSelected ? "#0F4C3A" : "#E5E7EB"}`,
              whiteSpace: "nowrap",
            }}
          >
            All Combined
          </Link>
        </div>
      </div>

      {/* Selected Customer Banner */}
      {selectedCustomer ? (
        <div
          className="card"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: "18px 22px",
            boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111418", margin: 0 }}>
                  {selectedCustomer.name}
                </h1>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "#6B7280", backgroundColor: "#F3F4F6", padding: "2px 6px", borderRadius: 4 }}>
                  {selectedCustomer.code}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#4B5563", marginTop: 4, marginBottom: 0 }}>
                Phone: {selectedCustomer.phone} · Financed Agreement:{" "}
                {selectedCustomer.contracts.map((ct: any) => (
                  <Link
                    key={ct.id}
                    href={`/dashboard/contracts/${ct.id}`}
                    style={{ color: "#0F4C3A", textDecoration: "underline", fontFamily: "monospace", fontWeight: 600, marginLeft: 4 }}
                  >
                    #{ct.contract_number}
                  </Link>
                ))}
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 12, color: "#0F4C3A", fontWeight: 700, display: "block" }}>
                {custRemainingPctFormatted} Remaining Balance
              </span>
              <span style={{ fontSize: 11, color: "#6B7280" }}>
                ({custPaidPctFormatted} Paid to date)
              </span>
            </div>
          </div>

          {/* Advance Down Payment Credited Banner */}
          {custOverallDownPayment > 0 && (
            <div
              style={{
                padding: "8px 12px",
                backgroundColor: "#F0FDF4",
                borderRadius: 6,
                border: "1px solid #BBF7D0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
              }}
            >
              <span style={{ color: "#166534", fontWeight: 600 }}>
                Advance Down Payment Credited:
              </span>
              <span className="tabular-nums" style={{ color: "#166534", fontWeight: 700 }}>
                {fmt(custOverallDownPayment)} (Deducted from Total)
              </span>
            </div>
          )}

          {/* Real-Time Progress Bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7280", marginBottom: 4 }}>
              <span style={{ fontWeight: 500 }}>Settlement Progress</span>
              <span style={{ fontWeight: 600, color: "#0F4C3A" }}>
                {custRemainingPctFormatted} remaining ({custPaidPctFormatted} paid)
              </span>
            </div>
            <div style={{ height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${custProgressLineWidth}%`,
                  backgroundColor: "#0F4C3A",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>
              <span>Paid: {fmt(custOverallPaid)} ({custPaidPctFormatted})</span>
              <span>Remaining: {fmt(custOverallRemaining)} ({custRemainingPctFormatted})</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: "#111418", margin: 0 }}>
              All Customer Installments
            </h1>
            <p style={{ fontSize: 13, color: "#4B5563", marginTop: 4, marginBottom: 0 }}>
              Viewing consolidated schedule across all active financing contracts.
            </p>
          </div>
        </div>
      )}

      {/* View Chips: Upcoming · Overdue · Partial · Paid · All */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {chips.map((chip) => {
          const isActive = currentView === chip.id;
          const countForChip = chip.id === "all"
            ? customerInstallments.length
            : customerInstallments.filter((p) => p.computedStatus === chip.id).length;

          return (
            <Link
              key={chip.id}
              href={`/dashboard/installments?customer=${customerParam}&view=${chip.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                transition: "all 150ms ease",
                backgroundColor: isActive ? "#EAF3EF" : "#FFFFFF",
                color: isActive ? "#0F4C3A" : "#4B5563",
                border: `1px solid ${isActive ? "#0F4C3A" : "#E5E7EB"}`,
              }}
            >
              <span>{chip.label}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  opacity: isActive ? 1 : 0.7,
                }}
              >
                {countForChip}
              </span>
            </Link>
          );
        })}
      </div>

      {/* KPI Tiles: Paid Amount · Remaining Balance · Installments Active */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div
          className="card"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: "16px 20px",
            boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", margin: 0 }}>
            Paid Amount
          </p>
          <p
            className="num"
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#166534",
              marginTop: 6,
              marginBottom: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmt(custOverallPaid)}
          </p>
          <p style={{ fontSize: 11, color: "#8A9099", margin: "4px 0 0" }}>
            {custOverallDownPayment > 0
              ? `Includes ${fmt(custOverallDownPayment)} advance down payment`
              : (currentView !== "all" && totalPaid !== custOverallPaid
                ? `Filtered view paid: ${fmt(totalPaid)}`
                : "Verified collections received")}
          </p>
        </div>

        <div
          className="card"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: "16px 20px",
            boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", margin: 0 }}>
            Remaining Balance
          </p>
          <p
            className="num"
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: currentView === "overdue" && totalRemaining > 0 ? "#B91C1C" : "#0F4C3A",
              marginTop: 6,
              marginBottom: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmt(currentView === "all" ? custOverallRemaining : totalRemaining)}
          </p>
          <p style={{ fontSize: 11, color: "#0F4C3A", fontWeight: 600, margin: "4px 0 0" }}>
            {custRemainingPctFormatted} remaining ({custPaidPctFormatted} paid)
          </p>
        </div>

        <div
          className="card"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: "16px 20px",
            boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", margin: 0 }}>
            {chips.find((c) => c.id === currentView)?.label ?? "Active"} Installments
          </p>
          <p
            className="num"
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#111418",
              marginTop: 6,
              marginBottom: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {totalCount} {totalCount === 1 ? "installment" : "installments"}
          </p>
          <p style={{ fontSize: 11, color: "#8A9099", margin: "4px 0 0" }}>
            {currentView === "overdue" && totalCount > 0
              ? "Requires immediate attention"
              : "In payment schedules"}
          </p>
        </div>
      </div>

      {/* Installment List Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Advance Down Payment Schedule Entry */}
        {selectedCustomer && selectedCustomer.totalDownPayment > 0 && (
          <div
            className="card"
            style={{
              backgroundColor: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: 8,
              padding: "16px 20px",
              boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: "#DCFCE7",
                    color: "#166534",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  #0
                </span>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#166534", margin: 0 }}>
                    Advance Down Payment
                  </h3>
                  <p style={{ fontSize: 11, color: "#166534", margin: "2px 0 0" }}>
                    Initial down payment settled at agreement signing · Deducted from total
                  </p>
                </div>
              </div>
              <span className="badge badge-paid">
                PAID AT SIGNING
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 8,
                padding: "10px 12px",
                backgroundColor: "#FFFFFF",
                borderRadius: 6,
                border: "1px solid #DCFCE7",
              }}
            >
              <div>
                <span style={{ fontSize: 10, color: "#6B7280", display: "block" }}>Installment Amount</span>
                <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                  {fmt(selectedCustomer.totalDownPayment)}
                </span>
              </div>
              <div>
                <span style={{ fontSize: 10, color: "#166534", display: "block" }}>Confirmed Received</span>
                <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 700, color: "#166534" }}>
                  {fmt(selectedCustomer.totalDownPayment)}
                </span>
              </div>
              <div>
                <span style={{ fontSize: 10, color: "#6B7280", display: "block" }}>Remaining</span>
                <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: "#166534" }}>
                  AED 0.00
                </span>
              </div>
              <div>
                <span style={{ fontSize: 10, color: "#6B7280", display: "block" }}>Settlement Status</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#166534" }}>
                  ✓ Credited in Full
                </span>
              </div>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div
            className="card"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              padding: "40px 20px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 500, color: "#4B5563", margin: 0 }}>
              Nothing pending — you&apos;re all caught up.
            </p>
            <p style={{ fontSize: 12, color: "#8A9099", margin: "4px 0 0" }}>
              There are no installments matching the &quot;{currentView}&quot; filter.
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const customer = (item.contracts as any)?.customers;
            const contract = item.contracts as any;

            let badgeClass = "badge-upcoming";
            let statusText = "Upcoming";

            if (item.computedStatus === "paid") {
              badgeClass = "badge-paid";
              statusText = "Paid";
            } else if (item.computedStatus === "overdue") {
              badgeClass = "badge-overdue";
              statusText = "Overdue";
            } else if (item.computedStatus === "partial") {
              badgeClass = "badge-partial";
              statusText = "Partial";
            }

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  padding: "16px 20px",
                  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Header row: Customer + Status */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#111418",
                        margin: 0,
                        lineHeight: 1.3,
                      }}
                    >
                      {customer?.full_name ?? "Unknown Customer"}
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        color: "#8A9099",
                        margin: "3px 0 0",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span>{customer?.customer_code}</span>
                      {customer?.phone && (
                        <>
                          <span>·</span>
                          <span>{customer.phone}</span>
                        </>
                      )}
                      <span>·</span>
                      <Link
                        href={`/dashboard/contracts/${contract?.id}`}
                        style={{
                          color: "#0F4C3A",
                          textDecoration: "none",
                          fontFamily: "monospace",
                        }}
                      >
                        #{contract?.contract_number}
                      </Link>
                    </p>
                  </div>

                  <span className={`badge ${badgeClass}`}>{statusText}</span>
                </div>

                {/* Details grid: Installment #, Due Date, Installment Amount, Paid, Remaining */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 12,
                    paddingTop: 12,
                    borderTop: "1px solid #F3F4F6",
                    fontSize: 13,
                  }}
                >
                  <div>
                    <p style={{ fontSize: 11, color: "#8A9099", margin: 0 }}>
                      Installment
                    </p>
                    <p
                      style={{
                        fontWeight: 500,
                        color: "#111418",
                        marginTop: 2,
                        marginBottom: 0,
                      }}
                    >
                      #{item.installment_number}
                      {item.is_final_balance && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#8A9099",
                            marginLeft: 4,
                          }}
                        >
                          (Final)
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, color: "#8A9099", margin: 0 }}>
                      Due Date
                    </p>
                    <p
                      style={{
                        fontWeight: 500,
                        color: item.computedStatus === "overdue" ? "#B91C1C" : "#111418",
                        marginTop: 2,
                        marginBottom: 0,
                      }}
                    >
                      {fmtDate(item.due_date)}
                    </p>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, color: "#8A9099", margin: 0 }}>
                      Installment Amount
                    </p>
                    <p
                      className="num"
                      style={{
                        fontWeight: 500,
                        color: "#111418",
                        marginTop: 2,
                        marginBottom: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmt(item.expected_amount)}
                    </p>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, color: "#8A9099", margin: 0 }}>
                      Paid
                    </p>
                    <p
                      className="num"
                      style={{
                        fontWeight: 500,
                        color: "#166534",
                        marginTop: 2,
                        marginBottom: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmt(item.paid)}
                    </p>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, color: "#8A9099", margin: 0 }}>
                      Remaining
                    </p>
                    <p
                      className="num"
                      style={{
                        fontWeight: 600,
                        color:
                          item.remaining === 0
                            ? "#166534"
                            : item.computedStatus === "overdue"
                            ? "#B91C1C"
                            : "#B45309",
                        marginTop: 2,
                        marginBottom: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmt(item.remaining)}
                    </p>
                  </div>
                </div>

                {/* Rollover / Adjustment Notes Audit Trail */}
                {item.notes && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 12px",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: 6,
                      fontSize: 11,
                      color: "#475569",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: "#0F4C3A",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        fontSize: 10,
                      }}
                    >
                      Schedule Adjustment:
                    </span>
                    <span>{item.notes}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
