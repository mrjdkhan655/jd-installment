import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Contract Details — Customer Portal" };

const fmt = (n: number) =>
  "AED\u00A0" +
  n.toLocaleString("en-AE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

function statusBadgeClass(status: string) {
  switch (status) {
    case "paid":
    case "approved":
    case "active":
    case "completed":
      return "badge-paid";
    case "partial":
    case "warning":
      return "badge-partial";
    case "overdue":
    case "rejected":
      return "badge-overdue";
    case "pending":
    case "review":
      return "badge-pending";
    default:
      return "badge-upcoming";
  }
}

function formatStatus(status: string) {
  switch (status) {
    case "paid":
      return "Paid";
    case "partial":
      return "Partial";
    case "overdue":
      return "Overdue";
    case "pending":
      return "Pending";
    case "upcoming":
      return "Upcoming";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export default async function CustomerContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch contract along with customer & product info
  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .select(
      `
      id,
      contract_number,
      status,
      total_amount,
      down_payment,
      start_date,
      planned_end_date,
      products (
        id,
        kind,
        cars (make, model, model_year, registration_number),
        gold_assets (gold_type, karat, weight_grams, serial_number),
        other_products (product_name, reference_number)
      ),
      customers (
        id,
        customer_code,
        full_name,
        profile_id
      )
    `
    )
    .eq("id", id)
    .single();

  if (contractErr || !contract) {
    redirect("/portal");
  }

  // Fetch installment schedule
  const { data: schedule } = await supabase
    .from("installment_schedules")
    .select("*")
    .eq("contract_id", id)
    .order("installment_number", { ascending: true });

  // Fetch all payments for this contract
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("contract_id", id)
    .order("payment_date", { ascending: false });

  // Calculate official paid per installment
  const paidByInstallment = new Map<string, number>();
  let rawOfficialPaid = 0;

  (payments ?? [])
    .filter(
      (p) =>
        p.verification_status === "not_required" ||
        p.verification_status === "approved"
    )
    .forEach((p) => {
      rawOfficialPaid += p.amount;
      if (p.installment_id) {
        paidByInstallment.set(
          p.installment_id,
          (paidByInstallment.get(p.installment_id) ?? 0) + p.amount
        );
      }
    });

  const dp = Number(contract.down_payment) || 0;
  const hasDpInPayments = (payments ?? []).some(
    (p) =>
      (p.verification_status === "not_required" || p.verification_status === "approved") &&
      (p.reference_number === "ADVANCE-DOWNPAYMENT" || (p.notes && p.notes.toLowerCase().includes("down payment")))
  );
  const totalOfficialPaid = rawOfficialPaid + (hasDpInPayments ? 0 : dp);
  const totalAgreed = contract.total_amount ?? 0;
  const outstanding = Math.max(0, totalAgreed - totalOfficialPaid);

  // High-precision percentage calculations (supports fractional percentages like 0.3%)
  const paidFraction = totalAgreed > 0 ? (totalOfficialPaid / totalAgreed) * 100 : 0;
  const remainingFraction = Math.max(0, 100 - paidFraction);
  const paidPctFormatted = paidFraction === 0 ? "0%" : paidFraction < 1 ? `${paidFraction.toFixed(1)}%` : Number.isInteger(paidFraction) ? `${paidFraction}%` : `${paidFraction.toFixed(1)}%`;
  const remainingPctFormatted = remainingFraction === 100 ? "100%" : remainingFraction > 99 ? `${remainingFraction.toFixed(1)}%` : Number.isInteger(remainingFraction) ? `${remainingFraction}%` : `${remainingFraction.toFixed(1)}%`;
  const progressLineWidth = totalOfficialPaid > 0 ? Math.max(2, Math.min(100, paidFraction)) : 0;

  // Pending payments (awaiting admin verification)
  const pendingSubmissions = (payments ?? []).filter(
    (p) => p.verification_status === "pending"
  );
  const pendingTotal = pendingSubmissions.reduce((s, p) => s + p.amount, 0);

  // Product description display
  const p = contract.products as any;
  let productName = "Contract";
  if (p?.cars) {
    const car = Array.isArray(p.cars) ? p.cars[0] : p.cars;
    productName = `${car?.make ?? ""} ${car?.model ?? ""} ${car?.model_year ?? ""}`.trim() || "Vehicle";
  } else if (p?.gold_assets) {
    const gold = Array.isArray(p.gold_assets) ? p.gold_assets[0] : p.gold_assets;
    productName = `${gold?.weight_grams ? gold.weight_grams + "g " : ""}${gold?.gold_type ?? "Gold"} ${gold?.karat ? gold.karat + "K" : ""}`.trim() || "Gold Asset";
  } else if (p?.other_products) {
    const other = Array.isArray(p.other_products) ? p.other_products[0] : p.other_products;
    productName = other?.product_name || "Item";
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#F7F8FA",
        color: "#111418",
        paddingBottom: 48,
      }}
    >
      {/* Top Bar / Navigation strip */}
      <header
        style={{
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              href="/portal"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1px solid #E5E7EB",
                color: "#4B5563",
                textDecoration: "none",
                fontSize: 14,
              }}
              aria-label="Back to portal"
            >
              ←
            </Link>
            <div>
              <p
                style={{
                  fontSize: 11,
                  color: "#8A9099",
                  fontFamily: "monospace",
                  lineHeight: 1,
                  margin: 0,
                }}
              >
                {contract.contract_number}
              </p>
              <h1
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111418",
                  margin: "2px 0 0",
                  lineHeight: 1.2,
                }}
              >
                {productName}
              </h1>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              href={`/portal/contracts/${contract.id}/pay`}
              className="btn-primary"
              style={{
                height: 36,
                minHeight: 36,
                padding: "0 14px",
                fontSize: 13,
                fontWeight: 600,
                backgroundColor: "#0F4C3A",
                color: "#FFFFFF",
                borderRadius: 8,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Pay Now
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area — max 640px for customer portal */}
      <main
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Financial Summary Card with Hero Figure */}
        <div
          className="card"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: "20px 16px",
            boxShadow:
              "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#8A9099",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Outstanding Balance
            </p>
            {/* 28px Hero figure per design specification */}
            <p
              className="num"
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: outstanding > 0 ? "#B45309" : "#166534",
                margin: "4px 0 0",
                lineHeight: 1.1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmt(outstanding)}
            </p>
          </div>

          {/* Key Figures Definition List */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              paddingTop: 12,
              borderTop: "1px solid #E5E7EB",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#4B5563" }}>Total Agreed Amount</span>
              <span
                className="num"
                style={{
                  fontWeight: 500,
                  color: "#111418",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmt(totalAgreed)}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#4B5563" }}>Total Confirmed Paid</span>
              <span
                className="num"
                style={{
                  fontWeight: 500,
                  color: "#166534",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmt(totalOfficialPaid)}
              </span>
            </div>

            {pendingTotal > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#1D4ED8" }}>Pending Verification</span>
                <span
                  className="num"
                  style={{
                    fontWeight: 500,
                    color: "#1D4ED8",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmt(pendingTotal)}
                </span>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#4B5563" }}>Agreement Start Date</span>
              <span style={{ color: "#111418" }}>
                {fmtDate(contract.start_date)}
              </span>
            </div>

            {contract.planned_end_date && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#4B5563" }}>Planned End Date</span>
                <span style={{ color: "#111418" }}>
                  {fmtDate(contract.planned_end_date)}
                </span>
              </div>
            )}

            {dp > 0 && (
              <div
                style={{
                  marginTop: 6,
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
                  {fmt(dp)} (Deducted from Total)
                </span>
              </div>
            )}

            {/* Visual Real-Time Settlement Progress Line */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #E5E7EB" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280", marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>Payment Progress</span>
                <span style={{ fontWeight: 700, color: "#0F4C3A" }}>
                  {remainingPctFormatted} remaining ({paidPctFormatted} paid)
                </span>
              </div>
              <div style={{ height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${progressLineWidth}%`,
                    backgroundColor: "#0F4C3A",
                    borderRadius: 4,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>
                <span>Paid: {fmt(totalOfficialPaid)} ({paidPctFormatted})</span>
                <span>Remaining: {fmt(outstanding)} ({remainingPctFormatted})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Visually Separated Pending Review Zone */}
        {pendingSubmissions.length > 0 && (
          <section
            style={{
              backgroundColor: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: 8,
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1D4ED8",
                  margin: 0,
                }}
              >
                Pending Review ({pendingSubmissions.length})
              </h2>
              <span className="badge badge-pending">Provisional</span>
            </div>
            <p
              style={{
                fontSize: 12,
                color: "#3B82F6",
                margin: "0 0 12px",
                lineHeight: 1.4,
              }}
            >
              These submissions have been received but are awaiting shopkeeper verification. They do not yet count toward your official balance.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #DBEAFE",
                    borderRadius: 6,
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p
                      className="num"
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#111418",
                        margin: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmt(sub.amount)}
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        color: "#8A9099",
                        margin: "2px 0 0",
                      }}
                    >
                      {fmtDate(sub.payment_date)} · {sub.method}
                      {sub.reference_number ? ` · Ref: ${sub.reference_number}` : ""}
                    </p>
                  </div>
                  <span className="badge badge-pending">Under Review</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Installment Schedule Section */}
        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
              padding: "0 4px",
            }}
          >
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#111418",
                margin: 0,
              }}
            >
              Payment Schedule
            </h2>
            <span
              style={{
                fontSize: 12,
                color: "#8A9099",
              }}
            >
              {schedule?.length ?? 0} installments
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dp > 0 && (
              <div
                className="card"
                style={{
                  backgroundColor: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: 8,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        backgroundColor: "#DCFCE7",
                        color: "#166534",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      #0
                    </span>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#166534", display: "block" }}>
                        Advance Down Payment
                      </span>
                      <span style={{ fontSize: 11, color: "#166534" }}>
                        Settled at agreement signing · Deducted from Total Agreed
                      </span>
                    </div>
                  </div>
                  <span className="badge badge-paid">PAID AT SIGNING</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingTop: 6, borderTop: "1px solid #DCFCE7" }}>
                  <span style={{ color: "#166534" }}>Amount Credited:</span>
                  <span className="tabular-nums" style={{ fontWeight: 700, color: "#166534" }}>
                    {fmt(dp)}
                  </span>
                </div>
              </div>
            )}

            {(!schedule || schedule.length === 0) && (
              <div
                className="card"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  padding: "32px 16px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#4B5563",
                    margin: 0,
                  }}
                >
                  No installment schedule available yet.
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "#8A9099",
                    margin: "4px 0 0",
                  }}
                >
                  Contact administration if your contract schedule is missing.
                </p>
              </div>
            )}

            {(schedule ?? []).map((line) => {
              const paid = paidByInstallment.get(line.id) ?? 0;
              const remaining = Math.max(0, line.expected_amount - paid);
              const isOverdue =
                line.status === "overdue" ||
                (remaining > 0 &&
                  new Date(line.due_date).getTime() < new Date().setHours(0, 0, 0, 0));

              return (
                <div
                  key={line.id}
                  className="card"
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    padding: "14px 16px",
                    boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#111418",
                          margin: 0,
                        }}
                      >
                        Installment #{line.installment_number}
                        {line.is_final_balance && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 11,
                              fontWeight: 400,
                              color: "#8A9099",
                            }}
                          >
                            (Final Balance)
                          </span>
                        )}
                      </p>
                    </div>

                    <span
                      className={`badge ${
                        remaining === 0
                          ? "badge-paid"
                          : isOverdue
                          ? "badge-overdue"
                          : paid > 0
                          ? "badge-partial"
                          : "badge-upcoming"
                      }`}
                    >
                      {remaining === 0
                        ? "Paid"
                        : isOverdue
                        ? "Overdue"
                        : paid > 0
                        ? "Partial"
                        : "Upcoming"}
                    </span>
                  </div>

                  {/* 3-column financial breakdown */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 8,
                      fontSize: 12,
                      paddingTop: 8,
                      borderTop: "1px solid #F3F4F6",
                    }}
                  >
                    <div>
                      <p style={{ color: "#8A9099", margin: 0 }}>Due Date</p>
                      <p
                        style={{
                          fontWeight: 500,
                          color: isOverdue && remaining > 0 ? "#B91C1C" : "#111418",
                          margin: "2px 0 0",
                        }}
                      >
                        {fmtDate(line.due_date)}
                      </p>
                    </div>

                    <div>
                      <p style={{ color: "#8A9099", margin: 0 }}>Amount</p>
                      <p
                        className="num"
                        style={{
                          fontWeight: 500,
                          color: "#111418",
                          margin: "2px 0 0",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fmt(line.expected_amount)}
                      </p>
                    </div>

                    <div>
                      <p style={{ color: "#8A9099", margin: 0 }}>Remaining</p>
                      <p
                        className="num"
                        style={{
                          fontWeight: 600,
                          color:
                            remaining === 0
                              ? "#166534"
                              : isOverdue
                              ? "#B91C1C"
                              : "#B45309",
                          margin: "2px 0 0",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fmt(remaining)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom Direct CTA */}
        <div style={{ marginTop: 8 }}>
          <Link
            href={`/portal/contracts/${contract.id}/pay`}
            className="btn-primary btn-lg"
            style={{
              width: "100%",
              minHeight: 44,
              height: 44,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              backgroundColor: "#0F4C3A",
              color: "#FFFFFF",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Submit a Payment for this Contract
          </Link>
        </div>
      </main>
    </div>
  );
}
