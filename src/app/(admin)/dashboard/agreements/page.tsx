import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Agreements — InstallPro" };

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

export default async function AgreementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      `
      id,
      contract_number,
      total_amount,
      status,
      customers (
        full_name,
        customer_code
      ),
      products (
        kind
      ),
      agreements (
        id,
        generated_at
      )
    `
    )
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: 896,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 20,
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
          Agreements
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "#4B5563",
            marginTop: 4,
            marginBottom: 0,
          }}
        >
          Review and generate official agreement PDFs for active and completed customer contracts.
        </p>
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
        {(!contracts || contracts.length === 0) ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#4B5563", margin: 0 }}>
              No contracts available for agreement generation.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {contracts.map((c: any) => {
              const customer = c.customers;
              const productKind = c.products?.kind || "Contract";
              const generatedList = c.agreements ?? [];
              const genCount = generatedList.length;
              const lastGenerated = genCount > 0 ? generatedList[genCount - 1]?.generated_at : null;

              return (
                <div
                  key={c.id}
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#111418", margin: 0 }}>
                      {customer?.full_name ?? "Customer"}
                    </p>
                    <p style={{ fontSize: 12, color: "#4B5563", marginTop: 2, marginBottom: 0 }}>
                      <span style={{ fontFamily: "monospace", color: "#0F4C3A" }}>{c.contract_number}</span>
                      {" · "}
                      <span style={{ textTransform: "capitalize" }}>{productKind}</span>
                      {" · "}
                      <span className="num" style={{ fontWeight: 500, color: "#111418" }}>
                        {fmt(c.total_amount)}
                      </span>
                    </p>
                    <p style={{ fontSize: 11, color: "#8A9099", marginTop: 3, marginBottom: 0 }}>
                      {genCount > 0
                        ? `Generated ${genCount} ${genCount === 1 ? "time" : "times"} · last ${fmtDate(lastGenerated)}`
                        : "Not yet generated"}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <Link
                      href={`/dashboard/contracts/${c.id}/preview`}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 500,
                        borderRadius: 6,
                        backgroundColor: "#0F4C3A",
                        color: "#FFFFFF",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span>Preview & Print</span>
                    </Link>
                    <a
                      href={`/api/agreements/${c.id}?download=true`}
                      className="btn-secondary"
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 500,
                        borderRadius: 6,
                        border: "1px solid #E5E7EB",
                        backgroundColor: "#FFFFFF",
                        color: "#111418",
                        textDecoration: "none",
                      }}
                      title="Download PDF File"
                    >
                      PDF
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
