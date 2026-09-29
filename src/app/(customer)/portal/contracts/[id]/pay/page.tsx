"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitCustomerPayment } from "@/lib/actions/payments";

const fmt = (n: number) =>
  "AED\u00A0" +
  n.toLocaleString("en-AE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export default function CustomerPayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const resolvedParams = use(params);
  const contractId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [contract, setContract] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [installmentId, setInstallmentId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [method, setMethod] = useState<string>("bank_transfer");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileData, setFileData] = useState<File | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: c } = await supabase
          .from("contracts")
          .select("id, contract_number, total_amount, customer_id")
          .eq("id", contractId)
          .single();

        if (c) setContract(c);

        const { data: s } = await supabase
          .from("installment_schedules")
          .select("*")
          .eq("contract_id", contractId)
          .order("installment_number", { ascending: true });

        if (s) {
          setSchedule(s);
          // Pre-select first unpaid installment if available
          const firstUnpaid = s.find((item) => item.status !== "paid");
          if (firstUnpaid) {
            setInstallmentId(firstUnpaid.id);
            setAmount(firstUnpaid.expected_amount.toString());
          }
        }
      } catch {
        setError("Unable to load contract details.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [contractId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFileData(f);
      setFileName(f.name);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let proofDocId: string | null = null;

      // Optional file upload to Supabase storage
      if (fileData) {
        const ext = fileData.name.split(".").pop() || "bin";
        const cleanName = `${Date.now()}.${ext}`;
        // Path pattern strictly aligns with RLS: {customer_id}/{contract_id}/{filename}
        const custFolder = contract?.customer_id || "general";
        const storagePath = `${custFolder}/${contractId}/${cleanName}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("documents")
          .upload(storagePath, fileData);

        if (uploadErr) {
          console.error("Proof upload error:", uploadErr);
          throw new Error(`Failed to upload proof document: ${uploadErr.message}`);
        }

        if (uploadData) {
          const { data: docRecord, error: docErr } = await supabase
            .from("documents")
            .insert({
              customer_id: contract?.customer_id || null,
              contract_id: contractId,
              category: "receipt",
              storage_path: storagePath,
              file_name: fileData.name,
              mime_type: fileData.type || "application/octet-stream",
              file_size_bytes: fileData.size,
              uploaded_by: user?.id || null,
            })
            .select("id")
            .single();

          if (docErr) {
            console.error("Document record error:", docErr);
            throw new Error(`Failed to save document record: ${docErr.message}`);
          }
          if (docRecord) {
            proofDocId = docRecord.id;
          }
        }
      }

      await submitCustomerPayment({
        contractId,
        installmentId: installmentId ? installmentId : undefined,
        amount: numAmount,
        paymentDate,
        method: method as any,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        proofDocumentId: proofDocId || undefined,
      });

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Could not submit payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          backgroundColor: "#F7F8FA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <p style={{ fontSize: 13, color: "#8A9099" }}>Loading details…</p>
      </div>
    );
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
      {/* Header Strip */}
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
            gap: 10,
          }}
        >
          <Link
            href={`/portal/contracts/${contractId}`}
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
          >
            ←
          </Link>
          <div>
            <p
              style={{
                fontSize: 11,
                color: "#8A9099",
                fontFamily: "monospace",
                margin: 0,
              }}
            >
              {contract?.contract_number}
            </p>
            <h1
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#111418",
                margin: "2px 0 0",
              }}
            >
              Submit Payment
            </h1>
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "16px",
        }}
      >
        {success ? (
          <div
            className="card"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              padding: "24px 20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "#F0FDF4",
                color: "#166534",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                fontSize: 20,
              }}
            >
              ✓
            </div>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#111418",
                margin: 0,
              }}
            >
              Payment Submitted for Review
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "#4B5563",
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              Your payment receipt has been received. It appears in the Pending Review zone and will update your official balance as soon as the shopkeeper verifies it.
            </p>
            <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
              <Link
                href={`/portal/contracts/${contractId}`}
                className="btn-primary"
                style={{
                  flex: 1,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#0F4C3A",
                  color: "#FFFFFF",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 500,
                  fontSize: 14,
                }}
              >
                Back to Contract
              </Link>
            </div>
          </div>
        ) : (
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
            <form onSubmit={handleSubmit} noValidate>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {/* 1. Which installment dropdown */}
                <div className="field">
                  <label
                    htmlFor="installmentId"
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#8A9099",
                      marginBottom: 6,
                      display: "block",
                    }}
                  >
                    Which installment?
                  </label>
                  <select
                    id="installmentId"
                    value={installmentId}
                    onChange={(e) => {
                      setInstallmentId(e.target.value);
                      const sel = schedule.find((s) => s.id === e.target.value);
                      if (sel) setAmount(sel.expected_amount.toString());
                    }}
                    className="field-select"
                    style={{ minHeight: 44, fontSize: 14 }}
                  >
                    <option value="">Not sure / general payment</option>
                    {schedule.map((item) => (
                      <option key={item.id} value={item.id}>
                        Installment #{item.installment_number} — {fmt(item.expected_amount)} (Due {new Date(item.due_date).toLocaleDateString("en-AE", { day: "numeric", month: "short" })})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Amount Paid (rendered at 18px font per spec) */}
                <div className="field">
                  <label
                    htmlFor="amount"
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#8A9099",
                      marginBottom: 6,
                      display: "block",
                    }}
                  >
                    Amount Paid (AED)
                  </label>
                  <input
                    id="amount"
                    type="number"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="field-input num"
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      minHeight: 48,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                </div>

                {/* 3. Date Paid and Method side by side */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div className="field">
                    <label
                      htmlFor="paymentDate"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#8A9099",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Date Paid
                    </label>
                    <input
                      id="paymentDate"
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="field-input"
                      style={{ minHeight: 44, fontSize: 14 }}
                    />
                  </div>

                  <div className="field">
                    <label
                      htmlFor="method"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#8A9099",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Payment Method
                    </label>
                    <select
                      id="method"
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      className="field-select"
                      style={{ minHeight: 44, fontSize: 14 }}
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      <option value="pos">Card / POS</option>
                    </select>
                  </div>
                </div>

                {/* 4. Reference Number */}
                <div className="field">
                  <label
                    htmlFor="referenceNumber"
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#8A9099",
                      marginBottom: 6,
                      display: "block",
                    }}
                  >
                    Reference Number
                  </label>
                  <input
                    id="referenceNumber"
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. Bank transaction / receipt number"
                    className="field-input"
                    style={{ minHeight: 44, fontSize: 14 }}
                  />
                </div>

                {/* 5. Payment Proof (Camera first, then File picker) */}
                <div className="form-group">
                  <label
                    className="form-label"
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#6B7280",
                      marginBottom: 6,
                      display: "block",
                    }}
                  >
                    Proof of Transfer
                  </label>
                  <div className="file-action-buttons" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {/* Camera capture button */}
                    <label
                      className="btn-action-mobile"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        minHeight: 44,
                        border: "1px solid var(--border-default)",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: "#FFFFFF",
                        color: "#111827",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Capture Receipt</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: "none" }}
                        onChange={handleFileChange}
                      />
                    </label>

                    {/* Standard file picker */}
                    <label
                      className="btn-action-mobile-secondary"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        minHeight: 44,
                        border: "1px solid var(--border-default)",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: "#FFFFFF",
                        color: "#111827",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span>Browse Files</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        style={{ display: "none" }}
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>

                  {fileName && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--status-paid-text)",
                        marginTop: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: 500,
                      }}
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {fileName}
                    </p>
                  )}
                  <p
                    style={{
                      fontSize: 11,
                      color: "#6B7280",
                      marginTop: 4,
                    }}
                  >
                    Accepted: JPG, PNG, PDF up to 10MB.
                  </p>
                </div>

                {/* 6. Reference Number */}
                <div className="form-group">
                  <label
                    htmlFor="referenceNumber"
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#6B7280",
                      marginBottom: 6,
                      display: "block",
                    }}
                  >
                    Customer Reference
                  </label>
                  <input
                    id="referenceNumber"
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. Bank wire reference / transaction ID"
                    className="field-input font-mono"
                    style={{ minHeight: 44, fontSize: 13 }}
                  />
                </div>

                {/* 7. Disclaimer Note (Section 3.7) */}
                <div
                  className="portal-disclaimer-note"
                  style={{
                    backgroundColor: "var(--bg-subtle)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                    padding: "12px 14px",
                    fontSize: 12,
                    color: "#4B5563",
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Ledger Notice:</strong> Your submission will be audited by accounting before your official contract balance reflects this payment.
                </div>

                {/* Error notice */}
                {error && (
                  <p
                    role="alert"
                    style={{
                      fontSize: 12,
                      color: "var(--status-overdue-text)",
                      margin: 0,
                    }}
                  >
                    {error}
                  </p>
                )}

                {/* 8. Full-width Submit button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="portal-primary-submit"
                  style={{
                    width: "100%",
                    minHeight: 44,
                    borderRadius: "var(--radius-md)",
                    fontSize: 14,
                    fontWeight: 500,
                    backgroundColor: "var(--primary)",
                    color: "#FFFFFF",
                    border: "none",
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Submitting Payment…" : "Submit Payment for Review"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
