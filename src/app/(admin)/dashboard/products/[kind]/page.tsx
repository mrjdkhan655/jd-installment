import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Asset3DCanvas } from "@/components/dashboard/DynamicVisuals";

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

export default async function ProductTypePage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const resolved = await params;
  const rawKind = resolved.kind.toLowerCase();
  const kind = rawKind.startsWith("car")
    ? "car"
    : rawKind.startsWith("gold")
    ? "gold"
    : "other";

  const title = kind === "car" ? "Cars" : kind === "gold" ? "Gold" : "Other Products";

  // Fetch contracts with this product kind
  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      `
      id,
      contract_number,
      status,
      total_amount,
      start_date,
      customers (
        id,
        full_name,
        customer_code
      ),
      products!inner (
        id,
        kind,
        name,
        cars (make, model, model_year, registration_number, chassis_number),
        gold_assets (gold_type, karat, weight_grams, serial_number, barcode),
        other_products (product_name, reference_number)
      )
    `
    )
    .eq("products.kind", kind)
    .order("created_at", { ascending: false });

  // Fetch payments to calculate paid and outstanding
  const { data: payments } = await supabase
    .from("payments")
    .select("contract_id, amount, verification_status")
    .in("verification_status", ["not_required", "approved"]);

  const paidMap = new Map<string, number>();
  (payments ?? []).forEach((p) => {
    paidMap.set(p.contract_id, (paidMap.get(p.contract_id) ?? 0) + p.amount);
  });

  const rows = (contracts ?? []).map((c: any) => {
    const p = c.products;
    let itemTitle = p?.name ?? "Item";
    let identifier = "—";

    if (kind === "car" && p.cars) {
      const car = Array.isArray(p.cars) ? p.cars[0] : p.cars;
      itemTitle = `${car?.make ?? ""} ${car?.model ?? ""} ${car?.model_year ?? ""}`.trim() || "Vehicle";
      identifier = [car?.registration_number, car?.chassis_number].filter(Boolean).join(" · ") || "—";
    } else if (kind === "gold" && p.gold_assets) {
      const gold = Array.isArray(p.gold_assets) ? p.gold_assets[0] : p.gold_assets;
      itemTitle = `${gold?.weight_grams ? gold.weight_grams + "g " : ""}${gold?.gold_type ?? "Gold"} ${gold?.karat ? gold.karat + "K" : ""}`.trim() || p.name;
      identifier = [gold?.serial_number, gold?.barcode].filter(Boolean).join(" · ") || "—";
    } else if (kind === "other" && p.other_products) {
      const other = Array.isArray(p.other_products) ? p.other_products[0] : p.other_products;
      itemTitle = other?.product_name || p.name;
      identifier = other?.reference_number || "—";
    }

    const paid = paidMap.get(c.id) ?? 0;
    const total = c.total_amount ?? 0;
    const outstanding = Math.max(0, total - paid);

    return {
      id: c.id,
      contract_number: c.contract_number,
      customer_name: c.customers?.full_name ?? "—",
      customer_code: c.customers?.customer_code ?? "",
      status: c.status,
      start_date: c.start_date,
      itemTitle,
      identifier,
      total,
      paid,
      outstanding,
    };
  });

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
            {title}
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "#4B5563",
              marginTop: 4,
              marginBottom: 0,
            }}
          >
            {rows.length} {rows.length === 1 ? "asset contract" : "asset contracts"} registered
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

      {/* 3D Model Interactive Asset Showcase */}
      <div
        className="card"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          padding: "20px",
          boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#111418", margin: 0 }}>
              Physical Asset Appraisal & Specification
            </h2>
            <p style={{ fontSize: 12, color: "#8A9099", margin: "2px 0 0" }}>
              Interactive 3D digital twin of {kind === "car" ? "vehicle inventory" : kind === "gold" ? "allocated gold ingots" : "financed physical inventory"}.
            </p>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#0F4C3A",
              backgroundColor: "#EAF3EF",
              padding: "2px 8px",
              borderRadius: 12,
            }}
          >
            3D Canvas Active
          </span>
        </div>

        <Asset3DCanvas kind={kind} height={200} />
      </div>

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
        {rows.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#4B5563", margin: 0 }}>
              No {title.toLowerCase()} contracts found.
            </p>
            <p style={{ fontSize: 12, color: "#8A9099", marginTop: 4 }}>
              Click &quot;+ New Contract&quot; to create a {kind} installment plan.
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
                      Item
                    </th>
                    <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 500, color: "#8A9099" }}>
                      Identifiers
                    </th>
                    <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 500, color: "#8A9099" }}>
                      Customer
                    </th>
                    <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 500, color: "#8A9099" }}>
                      Contract #
                    </th>
                    <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 500, color: "#8A9099" }}>
                      Start Date
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
                      Total Value
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
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: "1px solid #E5E7EB",
                        transition: "background-color 150ms ease",
                      }}
                      className="hover:bg-[#F7F8FA]"
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <p style={{ fontWeight: 600, color: "#111418", margin: 0 }}>
                          {r.itemTitle}
                        </p>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: 12,
                            color: "#4B5563",
                          }}
                        >
                          {r.identifier}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <p style={{ fontWeight: 500, color: "#111418", margin: 0 }}>
                          {r.customer_name}
                        </p>
                        <p style={{ fontSize: 11, color: "#8A9099", margin: "2px 0 0" }}>
                          {r.customer_code}
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
                          {r.contract_number}
                        </Link>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#4B5563" }}>
                        {fmtDate(r.start_date)}
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
                        {fmt(r.total)}
                      </td>
                      <td
                        className="num"
                        style={{
                          padding: "12px 16px",
                          textAlign: "right",
                          fontWeight: 500,
                          color: r.outstanding > 0 ? "#B45309" : "#166534",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fmt(r.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (< 1024px) */}
            <div className="lg:hidden divide-y divide-[#E5E7EB]">
              {rows.map((r) => (
                <div
                  key={r.id}
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
                      {r.itemTitle}
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        fontFamily: "monospace",
                        color: "#4B5563",
                        marginTop: 2,
                        marginBottom: 0,
                      }}
                    >
                      {r.identifier}
                    </p>
                    <p style={{ fontSize: 11, color: "#8A9099", marginTop: 4, marginBottom: 0 }}>
                      {r.customer_name} · {r.contract_number}
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
                      {fmt(r.total)}
                    </p>
                    <p
                      className="num"
                      style={{
                        fontSize: 11,
                        color: r.outstanding > 0 ? "#B45309" : "#166534",
                        marginTop: 2,
                        marginBottom: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.outstanding > 0 ? `${fmt(r.outstanding)} left` : "Paid"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
