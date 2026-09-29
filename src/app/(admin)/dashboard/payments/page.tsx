import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Payments — InstallPro" };

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

function statusBadgeClass(status: string) {
  switch (status) {
    case "approved":
    case "not_required":
      return "badge-approved";
    case "pending":
      return "badge-pending";
    case "rejected":
      return "badge-rejected";
    default:
      return "badge-neutral";
  }
}

function formatStatus(status: string) {
  switch (status) {
    case "not_required":
      return "Recorded";
    case "approved":
      return "Approved";
    case "pending":
      return "Pending Review";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string; page?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const resolvedParams = await searchParams;
  const pageNum = Math.max(1, Number(resolvedParams.page ?? 1));
  const pageSize = 30;
  const offset = (pageNum - 1) * pageSize;

  let query = supabase
    .from("payments")
    .select(
      `
      id,
      amount,
      payment_date,
      method,
      reference_number,
      verification_status,
      rejection_reason,
      contracts (
        id,
        contract_number,
        customers (
          id,
          full_name,
          customer_code
        )
      )
    `,
      { count: "exact" }
    )
    .order("payment_date", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (resolvedParams.from) query = query.gte("payment_date", resolvedParams.from);
  if (resolvedParams.to) query = query.lte("payment_date", resolvedParams.to);
  if (resolvedParams.status) query = query.eq("verification_status", resolvedParams.status);

  const { data: payments, count } = await query;

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Compute page totals
  const officialPayments = (payments ?? []).filter((p) =>
    ["not_required", "approved"].includes(p.verification_status)
  );
  const officialTotal = officialPayments.reduce((s, p) => s + Number(p.amount), 0);

  const pendingPayments = (payments ?? []).filter(
    (p) => p.verification_status === "pending"
  );
  const pendingTotal = pendingPayments.reduce((s, p) => s + Number(p.amount), 0);

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
      {/* Title & Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#111418",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            Payments
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "#4B5563",
              marginTop: 4,
              marginBottom: 0,
            }}
          >
            Cash book and payment ledger across all customer contracts.
          </p>
        </div>

        <Link
          href="/dashboard/payments/verification"
          className="btn-secondary"
          style={{
            height: 38,
            padding: "0 14px",
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 8,
            border: "1px solid #E5E7EB",
            backgroundColor: "#FFFFFF",
            color: "#111418",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Review Submissions
        </Link>
      </div>

      {/* 3 KPI Tiles per Specification */}
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
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#8A9099",
              margin: 0,
            }}
          >
            Official Received (This Page)
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
            {fmt(officialTotal)}
          </p>
          <p style={{ fontSize: 11, color: "#8A9099", margin: "4px 0 0" }}>
            Confirmed & reconciled funds
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
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#8A9099",
              margin: 0,
            }}
          >
            Pending Verification (This Page)
          </p>
          <p
            className="num"
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: pendingTotal > 0 ? "#1D4ED8" : "#8A9099",
              marginTop: 6,
              marginBottom: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmt(pendingTotal)}
          </p>
          <p style={{ fontSize: 11, color: "#8A9099", margin: "4px 0 0" }}>
            Awaiting shopkeeper review
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
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#8A9099",
              margin: 0,
            }}
          >
            Record Count
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
            {totalCount} {totalCount === 1 ? "record" : "records"}
          </p>
          <p style={{ fontSize: 11, color: "#8A9099", margin: "4px 0 0" }}>
            Matching active filters
          </p>
        </div>
      </div>

      {/* Filter Card — Plain GET form for URL bookmarkability */}
      <form
        method="get"
        className="card"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          padding: "16px",
          boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          alignItems: "flex-end",
        }}
      >
        <div className="field">
          <label
            className="field-label"
            style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", marginBottom: 4 }}
          >
            From Date
          </label>
          <input
            type="date"
            name="from"
            defaultValue={resolvedParams.from}
            className="field-input"
            style={{ minHeight: 40, fontSize: 14 }}
          />
        </div>

        <div className="field">
          <label
            className="field-label"
            style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", marginBottom: 4 }}
          >
            To Date
          </label>
          <input
            type="date"
            name="to"
            defaultValue={resolvedParams.to}
            className="field-input"
            style={{ minHeight: 40, fontSize: 14 }}
          />
        </div>

        <div className="field">
          <label
            className="field-label"
            style={{ fontSize: 12, fontWeight: 500, color: "#8A9099", marginBottom: 4 }}
          >
            Status
          </label>
          <select
            name="status"
            defaultValue={resolvedParams.status ?? ""}
            className="field-select"
            style={{ minHeight: 40, fontSize: 14 }}
          >
            <option value="">All Statuses</option>
            <option value="not_required">Recorded (Admin)</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending Review</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          <button
            type="submit"
            className="btn-primary"
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
            Apply Filters
          </button>
        </div>
      </form>

      {/* Payment Records Table & Mobile Cards */}
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
        {(!payments || payments.length === 0) ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#4B5563",
                margin: 0,
              }}
            >
              No payment records match these filters.
            </p>
            <p
              style={{
                fontSize: 12,
                color: "#8A9099",
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              Try clearing or widening your date range.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#F7F8FA",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 500, color: "#8A9099" }}>
                      Date
                    </th>
                    <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 500, color: "#8A9099" }}>
                      Customer
                    </th>
                    <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 500, color: "#8A9099" }}>
                      Contract #
                    </th>
                    <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 500, color: "#8A9099" }}>
                      Method
                    </th>
                    <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 500, color: "#8A9099" }}>
                      Status
                    </th>
                    <th
                      className="num"
                      style={{
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#8A9099",
                        textAlign: "right",
                      }}
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const contract = p.contracts as any;
                    const customer = contract?.customers;

                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: "1px solid #E5E7EB",
                          transition: "background-color 150ms ease",
                        }}
                        className="hover:bg-[#F7F8FA]"
                      >
                        <td style={{ padding: "12px 16px", color: "#4B5563" }}>
                          {fmtDate(p.payment_date)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <p style={{ fontWeight: 500, color: "#111418", margin: 0 }}>
                            {customer?.full_name ?? "—"}
                          </p>
                          <p style={{ fontSize: 11, color: "#8A9099", margin: "2px 0 0" }}>
                            {customer?.customer_code}
                          </p>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <Link
                            href={`/dashboard/contracts`}
                            style={{
                              color: "#0F4C3A",
                              fontFamily: "monospace",
                              fontSize: 12,
                              fontWeight: 500,
                              textDecoration: "none",
                            }}
                          >
                            {contract?.contract_number ?? "—"}
                          </Link>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#4B5563", textTransform: "capitalize" }}>
                          {p.method?.replace("_", " ")}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span className={`badge ${statusBadgeClass(p.verification_status)}`}>
                            {formatStatus(p.verification_status)}
                          </span>
                        </td>
                        <td
                          className="num"
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            fontWeight: 500,
                            color: ["approved", "not_required"].includes(p.verification_status)
                              ? "#166534"
                              : p.verification_status === "rejected"
                              ? "#B91C1C"
                              : "#1D4ED8",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmt(p.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< 1024px) */}
            <div className="lg:hidden divide-y divide-[#E5E7EB]">
              {payments.map((p) => {
                const contract = p.contracts as any;
                const customer = contract?.customers;

                return (
                  <div
                    key={p.id}
                    style={{
                      padding: "16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#111418", margin: 0 }}>
                        {customer?.full_name ?? "—"}
                      </p>
                      <p style={{ fontSize: 11, color: "#8A9099", marginTop: 2, marginBottom: 0 }}>
                        {fmtDate(p.payment_date)} · {p.method?.replace("_", " ")}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          fontFamily: "monospace",
                          color: "#0F4C3A",
                          marginTop: 2,
                          marginBottom: 0,
                        }}
                      >
                        {contract?.contract_number}
                      </p>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <p
                        className="num"
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: ["approved", "not_required"].includes(p.verification_status)
                            ? "#166534"
                            : p.verification_status === "rejected"
                            ? "#B91C1C"
                            : "#1D4ED8",
                          margin: 0,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fmt(p.amount)}
                      </p>
                      <div style={{ marginTop: 4 }}>
                        <span className={`badge ${statusBadgeClass(p.verification_status)}`}>
                          {formatStatus(p.verification_status)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderTop: "1px solid #E5E7EB",
                  fontSize: 13,
                }}
              >
                <Link
                  href={`/dashboard/payments?page=${pageNum - 1}`}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #E5E7EB",
                    textDecoration: "none",
                    color: pageNum <= 1 ? "#8A9099" : "#111418",
                    opacity: pageNum <= 1 ? 0.4 : 1,
                    pointerEvents: pageNum <= 1 ? "none" : "auto",
                  }}
                >
                  Previous
                </Link>

                <span style={{ color: "#4B5563" }}>
                  Page {pageNum} of {totalPages}
                </span>

                <Link
                  href={`/dashboard/payments?page=${pageNum + 1}`}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #E5E7EB",
                    textDecoration: "none",
                    color: pageNum >= totalPages ? "#8A9099" : "#111418",
                    opacity: pageNum >= totalPages ? 0.4 : 1,
                    pointerEvents: pageNum >= totalPages ? "none" : "auto",
                  }}
                >
                  Next
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
