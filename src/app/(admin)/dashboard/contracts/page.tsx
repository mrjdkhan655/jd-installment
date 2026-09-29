import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteContractButton } from "@/components/contracts/DeleteContractButton";

export const metadata = { title: "Contracts — InstallPro" };

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
    case "active":
      return "badge-active";
    case "completed":
      return "badge-completed";
    case "draft":
      return "badge-draft";
    case "extended":
      return "badge-extended";
    case "cancelled":
      return "badge-cancelled";
    default:
      return "badge-neutral";
  }
}

export default async function ContractsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const resolvedParams = await searchParams;
  const currentStatus = (resolvedParams.status || "all").toLowerCase();

  // Fetch contracts
  let query = supabase
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
      customers (
        id,
        customer_code,
        full_name,
        phone
      ),
      products (
        id,
        kind
      )
    `
    )
    .order("created_at", { ascending: false });

  if (currentStatus !== "all") {
    query = query.eq("status", currentStatus);
  }

  const { data: contracts } = await query;

  // Fetch approved payments to calculate official paid and outstanding per contract
  const { data: payments } = await supabase
    .from("payments")
    .select("contract_id, amount, verification_status")
    .in("verification_status", ["not_required", "approved"]);

  const paidMap = new Map<string, number>();
  (payments ?? []).forEach((p) => {
    paidMap.set(p.contract_id, (paidMap.get(p.contract_id) ?? 0) + p.amount);
  });

  const processed = (contracts ?? []).map((c) => {
    const paid = paidMap.get(c.id) ?? 0;
    const total = c.total_amount ?? 0;
    const outstanding = Math.max(0, total - paid);
    return {
      ...c,
      paid,
      outstanding,
    };
  });

  const chips = [
    { id: "all", label: "All" },
    { id: "draft", label: "Draft" },
    { id: "active", label: "Active" },
    { id: "completed", label: "Completed" },
    { id: "extended", label: "Extended" },
    { id: "cancelled", label: "Cancelled" },
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
      {/* Title & Action Bar */}
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
            Contracts
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "#4B5563",
              marginTop: 4,
              marginBottom: 0,
            }}
          >
            {processed.length} {processed.length === 1 ? "contract" : "contracts"} found
          </p>
        </div>

        <Link
          href="/dashboard/contracts/new"
          className="btn-primary"
          style={{
            height: 38,
            padding: "0 16px",
            fontSize: 13,
            fontWeight: 500,
            backgroundColor: "#0F4C3A",
            color: "#FFFFFF",
            borderRadius: 8,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          + New Contract
        </Link>
      </div>

      {/* Horizontal scrolling filter chips */}
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
          const isActive = currentStatus === chip.id;
          return (
            <Link
              key={chip.id}
              href={`/dashboard/contracts?status=${chip.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
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
              {chip.label}
            </Link>
          );
        })}
      </div>

      {/* Desktop Table (hidden below 1024px) & Mobile Stacked Cards (below 1024px) */}
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
        {processed.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#4B5563",
                margin: 0,
              }}
            >
              No contracts found.
            </p>
            <p
              style={{
                fontSize: 12,
                color: "#8A9099",
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              Create a new contract or select another filter chip.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
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
                    <th
                      style={{
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#8A9099",
                      }}
                    >
                      Contract #
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#8A9099",
                      }}
                    >
                      Customer
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#8A9099",
                      }}
                    >
                      Type
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#8A9099",
                      }}
                    >
                      Start Date
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#8A9099",
                      }}
                    >
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
                      Total
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
                      Paid
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
                      Outstanding
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#8A9099",
                        textAlign: "right",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map((c) => {
                    const customer = (c.customers as any);
                    const productKind = (c.products as any)?.kind || "item";

                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: "1px solid #E5E7EB",
                          transition: "background-color 150ms ease",
                        }}
                        className="hover:bg-[#F7F8FA]"
                      >
                        <td style={{ padding: "12px 16px" }}>
                          <Link
                            href={`/dashboard/contracts/${c.id}`}
                            style={{
                              fontFamily: "monospace",
                              fontSize: 12,
                              color: "var(--primary)",
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                            className="hover:underline"
                          >
                            {c.contract_number}
                          </Link>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <p
                            style={{
                              fontWeight: 500,
                              color: "#111418",
                              margin: 0,
                            }}
                          >
                            {customer?.full_name ?? "—"}
                          </p>
                          <p
                            style={{
                              fontSize: 11,
                              color: "#8A9099",
                              margin: "2px 0 0",
                            }}
                          >
                            {customer?.customer_code}
                          </p>
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            textTransform: "capitalize",
                            color: "#4B5563",
                          }}
                        >
                          {productKind}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            color: "#4B5563",
                          }}
                        >
                          {fmtDate(c.start_date)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span className={`badge ${statusBadgeClass(c.status)}`}>
                            {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                          </span>
                        </td>
                        <td
                          className="num"
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            fontWeight: 500,
                            color: "#111418",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmt(c.total_amount)}
                        </td>
                        <td
                          className="num"
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            fontWeight: 500,
                            color: "#166534",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmt(c.paid)}
                        </td>
                        <td
                          className="num"
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            fontWeight: 500,
                            color: c.outstanding > 0 ? "#B45309" : "#166534",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmt(c.outstanding)}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                          }}
                        >
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                            <Link
                              href={`/dashboard/contracts/${c.id}`}
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: "var(--primary)",
                                textDecoration: "none",
                                padding: "4px 8px",
                                borderRadius: 4,
                                backgroundColor: "var(--primary-tint)",
                              }}
                            >
                              View
                            </Link>
                            <DeleteContractButton
                              contractId={c.id}
                              contractNumber={c.contract_number}
                              variant="icon"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View (< 1024px) */}
            <div className="lg:hidden divide-y divide-[#E5E7EB]">
              {processed.map((c) => {
                const customer = (c.customers as any);
                const productKind = (c.products as any)?.kind || "item";

                return (
                  <div
                    key={c.id}
                    style={{
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "#8A9099",
                          fontWeight: 600,
                        }}
                      >
                        {productKind}
                      </span>
                      <span className={`badge ${statusBadgeClass(c.status)}`}>
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </span>
                    </div>

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
                          }}
                        >
                          {customer?.full_name ?? "—"}
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
                          {c.contract_number}
                        </p>
                      </div>

                      <div style={{ textAlign: "right" }}>
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
                          {fmt(c.total_amount)}
                        </p>
                        <p
                          className="num"
                          style={{
                            fontSize: 11,
                            color: c.outstanding > 0 ? "#B45309" : "#166534",
                            marginTop: 2,
                            marginBottom: 0,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {c.outstanding > 0 ? `${fmt(c.outstanding)} left` : "Paid"}
                        </p>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: 8,
                        marginTop: 4,
                        borderTop: "1px solid #F3F4F6",
                      }}
                    >
                      <Link
                        href={`/dashboard/contracts/${c.id}`}
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--primary)",
                          textDecoration: "none",
                        }}
                      >
                        View Agreement Details →
                      </Link>
                      <DeleteContractButton
                        contractId={c.id}
                        contractNumber={c.contract_number}
                        variant="icon"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
