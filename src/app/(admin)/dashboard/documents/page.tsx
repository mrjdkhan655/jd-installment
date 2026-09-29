import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Documents — InstallPro" };

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const resolvedParams = await searchParams;
  const activeCategory = (resolvedParams.category || "all").toLowerCase();

  let query = supabase
    .from("documents")
    .select(
      `
      id,
      file_name,
      file_url,
      category,
      created_at,
      customers (
        full_name,
        customer_code
      ),
      contracts (
        contract_number
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (activeCategory !== "all") {
    query = query.eq("category", activeCategory);
  }

  const { data: documents } = await query;

  const categories = [
    { id: "all", label: "All Documents" },
    { id: "id_proof", label: "Government IDs" },
    { id: "contract", label: "Agreements" },
    { id: "receipt", label: "Receipts" },
    { id: "other", label: "Other" },
  ];

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
          Document Library
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "#4B5563",
            marginTop: 4,
            marginBottom: 0,
          }}
        >
          Central repository for customer IDs, signed agreements, and proof-of-payment receipts.
        </p>
      </div>

      {/* Category Filter Chips */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {categories.map((c) => {
          const isActive = activeCategory === c.id;
          return (
            <Link
              key={c.id}
              href={`/dashboard/documents?category=${c.id}`}
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
              {c.label}
            </Link>
          );
        })}
      </div>

      {/* Document List */}
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
        {(!documents || documents.length === 0) ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#4B5563", margin: 0 }}>
              No documents found.
            </p>
            <p style={{ fontSize: 12, color: "#8A9099", marginTop: 4 }}>
              Uploaded customer IDs, contracts, and payment proofs will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {documents.map((doc: any) => {
              const customer = doc.customers;
              const contract = doc.contracts;

              return (
                <div
                  key={doc.id}
                  style={{
                    padding: "14px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        backgroundColor: "#F7F8FA",
                        border: "1px solid #E5E7EB",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontSize: 16,
                      }}
                    >
                      📄
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 13.5,
                          fontWeight: 500,
                          color: "#0F4C3A",
                          textDecoration: "none",
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {doc.file_name}
                      </a>
                      <p
                        style={{
                          fontSize: 11,
                          color: "#8A9099",
                          marginTop: 2,
                          marginBottom: 0,
                        }}
                      >
                        <span style={{ textTransform: "capitalize" }}>{doc.category?.replace("_", " ")}</span>
                        {customer?.full_name ? ` · ${customer.full_name}` : ""}
                        {contract?.contract_number ? ` · ${contract.contract_number}` : ""}
                        {` · ${fmtDate(doc.created_at)}`}
                      </p>
                    </div>
                  </div>

                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      borderRadius: 6,
                      border: "1px solid #E5E7EB",
                      backgroundColor: "#FFFFFF",
                      color: "#111418",
                      textDecoration: "none",
                      flexShrink: 0,
                    }}
                  >
                    Open
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
