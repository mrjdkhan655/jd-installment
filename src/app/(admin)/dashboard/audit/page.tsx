import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const metadata = { title: "Audit Log — InstallPro" };

const ACTION_LABELS: Record<string, string> = {
  "customer.create": "Created customer",
  "contract.create_draft": "Created draft contract",
  "contract.create_finalized": "Created and finalized contract",
  "contract.finalize": "Finalized contract",
  "contract.cancel": "Cancelled contract",
  "contract.schedule_update": "Updated installment schedule",
  "contract.penalty_update": "Changed penalty settings",
  "installment.update": "Modified an installment",
  "payment.record": "Recorded a payment",
  "payment.approved": "Approved a payment",
  "payment.rejected": "Rejected a payment",
  "agreement.generate": "Generated an agreement",
  "document.delete": "Deleted a document",
  "user.create": "Created a staff account",
  "user.role_change": "Changed a user role",
  "user.activate": "Enabled a user account",
  "user.deactivate": "Disabled a user account",
  "settings.update": "Updated business settings",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireSuperAdmin();
  const resolved = await searchParams;
  const pageNum = Math.max(1, Number(resolved.page ?? 1));
  const pageSize = 50;
  const offset = (pageNum - 1) * pageSize;

  const supabase = await createClient();
  const { data: logs, count } = await supabase
    .from("audit_logs")
    .select("*, profiles(full_name, role)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

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
          Audit Log
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "#4B5563",
            marginTop: 4,
            marginBottom: 0,
          }}
        >
          Immutable security trail of administrative actions and permission changes.
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
        {(!logs || logs.length === 0) ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#4B5563", margin: 0 }}>
              No audit records recorded yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {logs.map((l: any) => {
              const actor = l.profiles;
              const humanAction = ACTION_LABELS[l.action] ?? l.action;

              return (
                <div key={l.id} style={{ padding: "16px 20px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 16,
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#111418", margin: 0 }}>
                        {humanAction}
                      </p>
                      <p style={{ fontSize: 12, color: "#4B5563", marginTop: 2, marginBottom: 0 }}>
                        By{" "}
                        <span style={{ fontWeight: 500, color: "#111418" }}>
                          {actor?.full_name ?? "System"}
                        </span>{" "}
                        ({actor?.role?.replace("_", " ") ?? "system"})
                      </p>
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: 11, color: "#8A9099", margin: 0 }}>
                        {new Date(l.created_at).toLocaleDateString("en-AE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Collapsed change details disclosure if before/after exists */}
                  {(l.previous_value || l.new_value) && (
                    <details style={{ marginTop: 10, fontSize: 12 }}>
                      <summary style={{ cursor: "pointer", color: "#0F4C3A", fontWeight: 500 }}>
                        Change detail
                      </summary>
                      <div
                        style={{
                          marginTop: 8,
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: 10,
                          backgroundColor: "#F7F8FA",
                          padding: 10,
                          borderRadius: 6,
                          border: "1px solid #E5E7EB",
                          fontFamily: "monospace",
                          fontSize: 11,
                        }}
                      >
                        {l.previous_value && (
                          <div>
                            <p style={{ color: "#8A9099", margin: "0 0 4px" }}>Previous:</p>
                            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                              {JSON.stringify(l.previous_value, null, 2)}
                            </pre>
                          </div>
                        )}
                        {l.new_value && (
                          <div>
                            <p style={{ color: "#166534", margin: "0 0 4px" }}>New:</p>
                            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                              {JSON.stringify(l.new_value, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}

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
              href={`/dashboard/audit?page=${pageNum - 1}`}
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
              href={`/dashboard/audit?page=${pageNum + 1}`}
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
      </div>
    </div>
  );
}
