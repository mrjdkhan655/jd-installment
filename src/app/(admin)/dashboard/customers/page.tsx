import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomerSearchInput } from "@/components/customers/CustomerSearchInput";
import { DeleteCustomerButton } from "@/components/customers/DeleteCustomerButton";

export const metadata = { title: "Customers — InstallPro" };

const fmt = (n: number) =>
  "AED\u00A0" +
  n.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default async function CustomersListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const resolvedParams = await searchParams;
  const currentPage = Math.max(1, parseInt(resolvedParams.page || "1", 10));
  const pageSize = 25;
  const offset = (currentPage - 1) * pageSize;
  const queryText = (resolvedParams.q || "").trim();

  // Fetch customers with count
  let query = supabase
    .from("customers")
    .select(
      `
      id,
      customer_code,
      full_name,
      phone,
      government_id,
      contracts (
        id,
        status,
        total_amount
      )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (queryText) {
    query = query.or(
      `full_name.ilike.%${queryText}%,customer_code.ilike.%${queryText}%,phone.ilike.%${queryText}%,government_id.ilike.%${queryText}%`
    );
  }

  const { data: customers, count } = await query.range(
    offset,
    offset + pageSize - 1
  );

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Process contract aggregates per customer
  const processed = (customers ?? []).map((cust) => {
    const rawContracts = (cust.contracts as any[]) ?? [];
    const activeContracts = rawContracts.filter(
      (c) => c.status === "active"
    ).length;
    const totalContractValue = rawContracts.reduce(
      (s, c) => s + (c.total_amount ?? 0),
      0
    );

    return {
      ...cust,
      activeCount: activeContracts,
      totalValue: totalContractValue,
    };
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
      className="fade-in"
    >
      {/* Title & Action Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#111827",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            Customer Directory
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "#6B7280",
              marginTop: 4,
              marginBottom: 0,
            }}
          >
            {totalCount} registered account{totalCount === 1 ? "" : "s"} · Direct portfolio exposure
          </p>
        </div>

        <Link
          href="/dashboard/customers/new"
          className="btn-primary"
          style={{
            height: 40,
            padding: "0 18px",
            fontSize: 13,
            fontWeight: 500,
            backgroundColor: "var(--primary)",
            color: "#FFFFFF",
            borderRadius: "var(--radius-md)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          + New Customer
        </Link>
      </div>

      {/* Search Filter Bar (Section 3.2 Instant Debounce Filter) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <CustomerSearchInput defaultValue={queryText} />
      </div>

      {/* Customer List Card (Desktop Table + Mobile Cards) */}
      <div
        className="card"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {processed.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#4B5563",
                margin: 0,
              }}
            >
              {queryText ? "No customers match your search criteria." : "No customers registered yet."}
            </p>
            <p
              style={{
                fontSize: 12,
                color: "#6B7280",
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              {queryText ? "Try searching by name, phone number, or government ID." : "Click '+ New Customer' above to add your first customer."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (≥ 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: "var(--bg-subtle)",
                      borderBottom: "1px solid var(--border-default)",
                    }}
                  >
                    <th
                      style={{
                        padding: "10px 16px",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#6B7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                      }}
                    >
                      Customer ID
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#6B7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                      }}
                    >
                      Full Legal Name
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#6B7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                      }}
                    >
                      Phone Number
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#6B7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                      }}
                    >
                      Government ID / EID
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#6B7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                        textAlign: "center",
                      }}
                    >
                      Active Contracts
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#6B7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                        textAlign: "right",
                      }}
                    >
                      Total Exposure / Balance
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#6B7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                        textAlign: "right",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map((cust) => (
                    <tr
                      key={cust.id}
                      style={{
                        borderBottom: "1px solid var(--border-default)",
                        transition: "background-color 150ms ease",
                      }}
                      className="hover:bg-[#F7F8FA]"
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: 12,
                            color: "#6B7280",
                          }}
                        >
                          {cust.customer_code}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <Link
                          href={`/dashboard/customers/${cust.id}`}
                          style={{
                            fontWeight: 600,
                            color: "var(--primary)",
                            textDecoration: "none",
                          }}
                          className="hover:underline"
                        >
                          {cust.full_name}
                        </Link>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#4B5563" }} className="tabular-nums">
                        {cust.phone || "—"}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontFamily: "monospace",
                          fontSize: 12,
                          color: "#4B5563",
                        }}
                      >
                        {cust.government_id || "—"}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          textAlign: "center",
                          color: "#111827",
                          fontWeight: 500,
                        }}
                        className="tabular-nums"
                      >
                        {cust.activeCount}
                      </td>
                      <td
                        className="numeric-cell tabular-nums"
                        style={{
                          padding: "12px 16px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        {fmt(cust.totalValue)}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          textAlign: "right",
                        }}
                      >
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                          <Link
                            href={`/dashboard/customers/${cust.id}`}
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
                          <DeleteCustomerButton
                            customerId={cust.id}
                            customerName={cust.full_name}
                            customerCode={cust.customer_code}
                            variant="icon"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Transformation Pattern: Customer Record Card (< 768px — Section 3.2) */}
            <div className="md:hidden p-3 bg-[#F7F8FA] space-y-2">
              {processed.map((cust) => (
                <div
                  key={cust.id}
                  className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm"
                >
                  <Link
                    href={`/dashboard/customers/${cust.id}`}
                    className="block"
                    style={{ textDecoration: "none" }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-semibold text-gray-900 text-sm block">
                          {cust.full_name}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          {cust.customer_code}{cust.phone ? ` · ${cust.phone}` : ""}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-gray-900 text-sm block tabular-nums">
                          {fmt(cust.totalValue)}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {cust.activeCount} Active Contract{cust.activeCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-100">
                    <Link
                      href={`/dashboard/customers/${cust.id}`}
                      className="text-xs font-medium text-emerald-800"
                    >
                      View Account Profile →
                    </Link>
                    <DeleteCustomerButton
                      customerId={cust.id}
                      customerName={cust.full_name}
                      customerCode={cust.customer_code}
                      variant="icon"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderTop: "1px solid var(--border-default)",
                  fontSize: 13,
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Link
                  href={`/dashboard/customers?page=${currentPage - 1}${queryText ? `&q=${queryText}` : ""}`}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-default)",
                    textDecoration: "none",
                    color: currentPage <= 1 ? "#9CA3AF" : "#111827",
                    opacity: currentPage <= 1 ? 0.4 : 1,
                    pointerEvents: currentPage <= 1 ? "none" : "auto",
                    fontWeight: 500,
                  }}
                >
                  Previous
                </Link>

                <span style={{ color: "#6B7280" }}>
                  Page {currentPage} of {totalPages}
                </span>

                <Link
                  href={`/dashboard/customers?page=${currentPage + 1}${queryText ? `&q=${queryText}` : ""}`}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-default)",
                    textDecoration: "none",
                    color: currentPage >= totalPages ? "#9CA3AF" : "#111827",
                    opacity: currentPage >= totalPages ? 0.4 : 1,
                    pointerEvents: currentPage >= totalPages ? "none" : "auto",
                    fontWeight: 500,
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
