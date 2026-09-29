import { createClient } from "@/lib/supabase/server";
import { VerifyActions } from "./VerifyActions";

export const metadata = { title: "Payment Verification — InstallPro" };

function formatAED(n: number) {
  return "AED\u00A0" + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function VerificationQueuePage() {
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("payments")
    .select(`
      *,
      contracts (
        contract_number,
        customers (
          full_name,
          customer_code
        ),
        products (
          name,
          kind
        )
      ),
      documents:documents!fk_payments_proof_document (
        id,
        file_name,
        file_size_bytes,
        storage_path
      )
    `)
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true });

  const pendingList = pending ?? [];

  return (
    <div className="fade-in max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 leading-tight">
          Payment Verification Pipeline
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          {pendingList.length} customer-submitted payment{pendingList.length === 1 ? "" : "s"} awaiting audit. Unverified funds are strictly excluded from contract balances until approved.
        </p>
      </div>

      {pendingList.length === 0 ? (
        <div className="card p-12 text-center bg-white border border-gray-200 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-900">Verification Queue Clear</p>
          <p className="text-xs text-gray-500 mt-1">
            All customer submissions have been verified and credited to the official ledgers.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingList.map((p: any) => {
            const customer = p.contracts?.customers;
            const contract = p.contracts;
            const product = p.contracts?.products;
            const doc = p.documents;

            return (
              <div key={p.id} className="verification-card" id={`txn-verify-${p.id}`}>
                {/* Meta Header */}
                <div className="txn-meta-header">
                  <div>
                    <span className="customer-tag">
                      {customer?.full_name ?? "Customer"} ({customer?.customer_code ?? "—"})
                    </span>
                    <h4 className="contract-tag">
                      Contract #{contract?.contract_number ?? "—"} · {product?.kind ? product.kind.toUpperCase() : "ASSET"}: {product?.name || "Payment"}
                    </h4>
                  </div>
                  <div className="txn-amount-callout">
                    {formatAED(p.amount)}
                  </div>
                </div>

                {/* Proof Row */}
                <div className="txn-proof-row">
                  <div className="proof-data-item">
                    <span className="label">Date Submitted</span>
                    <span className="val tabular-nums">{formatDate(p.payment_date || p.created_at)}</span>
                  </div>
                  <div className="proof-data-item">
                    <span className="label">Payment Instrument</span>
                    <span className="val capitalize">
                      {p.method === "bank_transfer" ? "Direct Wire / Online Banking" : p.method.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="proof-data-item">
                    <span className="label">Customer Reference</span>
                    <span className="val font-mono">
                      {p.reference_number || "None Provided"}
                    </span>
                  </div>
                  <div className="proof-data-item">
                    <span className="label">Attachment</span>
                    <span className="val link">
                      {doc?.file_name ? (
                        <a
                          href={`/api/documents/${doc.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-800 hover:underline"
                        >
                          {doc.file_name} {doc.file_size_bytes ? `(${Math.round(doc.file_size_bytes / 1024)} KB)` : ""}
                        </a>
                      ) : (
                        <span className="text-gray-400 font-normal">No file receipt</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Client Actions & Rejection Drawer (Section 3.5) */}
                <VerifyActions paymentId={p.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
