"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = 1 | 2 | 3 | 4;
type ProductKind = "car" | "gold" | "other" | null;
type PlanType = "equal" | "fixed_final" | "custom";

interface InstallmentLine {
  id: string;
  due_date: string;
  amount: string;
  is_final: boolean;
}

const fmt = (n: number) =>
  "AED\u00A0" + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function uid() { return Math.random().toString(36).slice(2, 10); }

export default function NewContractPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>(1);
  const [customers, setCustomers] = useState<{ id: string; full_name: string; customer_code: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; kind: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [customerId, setCustomerId] = useState("");
  const [productKind, setProductKind] = useState<ProductKind>(null);
  const [productId, setProductId] = useState("");
  // Car fields
  const [car, setCar] = useState({ make: "", model: "", year: "", color: "", reg: "", chassis: "", engine: "", ref: "" });
  // Gold fields
  const [gold, setGold] = useState({ desc: "", type: "", karat: "", purity: "", weight: "", qty: "", serial: "", barcode: "", invoice: "" });
  // Other fields
  const [other, setOther] = useState({ name: "", desc: "", qty: "", ref: "" });

  // Step 2
  const [totalAmount, setTotalAmount]     = useState("");
  const [downPayment, setDownPayment]     = useState("");
  const [agreementDate, setAgreementDate] = useState("");
  const [startDate, setStartDate]         = useState("");
  const [planType, setPlanType]           = useState<PlanType>("equal");
  const [numInstallments, setNumInstallments] = useState("12");
  const [schedule, setSchedule]           = useState<InstallmentLine[]>([]);

  // Step 3
  const [penaltyEnabled, setPenaltyEnabled] = useState(false);
  const [penaltyMethod, setPenaltyMethod]   = useState("");
  const [penaltyValue, setPenaltyValue]     = useState("");
  const [penaltyNotes, setPenaltyNotes]     = useState("");

  // Computed
  const financed = Math.max(0, (parseFloat(totalAmount) || 0) - (parseFloat(downPayment) || 0));
  const scheduleTotal = schedule.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const diff = scheduleTotal - financed;
  const balanced = Math.abs(diff) < 0.01;

  useEffect(() => {
    supabase.from("customers").select("id, full_name, customer_code").then(({ data }) => setCustomers(data ?? []));
  }, []);

  useEffect(() => {
    if (productKind) {
      supabase.from("products").select("id, name, kind").eq("kind", productKind).then(({ data }) => setProducts(data ?? []));
    }
  }, [productKind]);

  function generateSchedule() {
    if (!financed || !numInstallments) return;
    const n = parseInt(numInstallments);
    if (isNaN(n) || n <= 0) return;
    const baseDate = startDate ? new Date(startDate) : new Date();
    const equalAmt = (financed / n).toFixed(2);
    const lines: InstallmentLine[] = Array.from({ length: n }, (_, i) => {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i + 1);
      return {
        id: uid(),
        due_date: d.toISOString().slice(0, 10),
        amount: i === n - 1 ? (financed - parseFloat(equalAmt) * (n - 1)).toFixed(2) : equalAmt,
        is_final: i === n - 1,
      };
    });
    setSchedule(lines);
  }

  function updateLine(id: string, field: keyof InstallmentLine, value: string | boolean) {
    setSchedule((s) => s.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  function deleteLine(id: string) {
    setSchedule((s) => s.filter((l) => l.id !== id));
  }

  function addLine() {
    const last = schedule[schedule.length - 1];
    const lastDate = last ? new Date(last.due_date) : new Date();
    lastDate.setMonth(lastDate.getMonth() + 1);
    setSchedule((s) => [...s, { id: uid(), due_date: lastDate.toISOString().slice(0, 10), amount: "0.00", is_final: false }]);
  }

  async function save(finalize: boolean) {
    if (!balanced) { setError("The schedule is not balanced. Adjust the installment amounts before saving."); return; }
    if (!customerId)   { setError("Please select a customer."); return; }
    if (!totalAmount)  { setError("Please enter a total amount."); return; }
    setSaving(true);
    setError(null);
    try {
      let finalProductId = productId;

      // If no existing inventory product was selected, create the product asset in the database
      if (!finalProductId) {
        const kind = productKind || "other";
        let productName = "Financed Asset";
        if (kind === "car") {
          productName = `${car.make || ""} ${car.model || ""} ${car.year || ""}`.trim() || "Vehicle";
        } else if (kind === "gold") {
          productName = gold.desc || (gold.type ? `Gold — ${gold.type}` : "Gold Collateral");
        } else {
          productName = other.name || other.desc || "Financed Asset";
        }

        const refNum = (kind === "car" ? car.reg || car.ref : kind === "gold" ? gold.serial || gold.barcode : other.ref) || null;

        const { data: newProd, error: prodErr } = await supabase
          .from("products")
          .insert({
            kind,
            name: productName,
            reference_number: refNum,
          })
          .select("id")
          .single();

        if (prodErr || !newProd) {
          throw new Error(prodErr?.message || "Failed to register product asset in inventory.");
        }

        finalProductId = newProd.id;

        // Insert into specific asset subtable
        if (kind === "car") {
          await supabase.from("cars").insert({
            product_id: finalProductId,
            make: car.make || null,
            model: car.model || null,
            model_year: car.year ? parseInt(car.year, 10) || null : null,
            color: car.color || null,
            registration_number: car.reg || null,
            chassis_number: car.chassis || null,
            engine_number: car.engine || null,
            vehicle_reference: car.ref || null,
          });
        } else if (kind === "gold") {
          await supabase.from("gold_assets").insert({
            product_id: finalProductId,
            description: gold.desc || null,
            gold_type: gold.type || null,
            purity: gold.purity || null,
            karat: gold.karat || null,
            weight_grams: gold.weight ? parseFloat(gold.weight) || null : null,
            quantity: gold.qty ? parseInt(gold.qty, 10) || 1 : 1,
            serial_number: gold.serial || null,
            barcode: gold.barcode || null,
            original_invoice_ref: gold.invoice || null,
          });
        } else if (kind === "other") {
          await supabase.from("other_products").insert({
            product_id: finalProductId,
            description: other.desc || null,
            quantity: other.qty ? parseInt(other.qty, 10) || 1 : 1,
          });
        }
      }

      // Map penalty_method to valid PostgreSQL enum values:
      // ('fixed_per_month', 'percent_per_month', 'custom_amount', 'custom_rule')
      let mappedPenaltyMethod: "fixed_per_month" | "percent_per_month" | "custom_amount" | "custom_rule" | null = null;
      if (penaltyEnabled && penaltyMethod) {
        if (penaltyMethod === "percent_per_month") mappedPenaltyMethod = "percent_per_month";
        else if (penaltyMethod === "fixed_per_month") mappedPenaltyMethod = "fixed_per_month";
        else if (penaltyMethod === "one_time" || penaltyMethod === "custom_amount") mappedPenaltyMethod = "custom_amount";
        else mappedPenaltyMethod = "custom_rule";
      }

      const contractNum = `CNT-${Date.now().toString().slice(-6)}`;
      const { data: contract, error: cErr } = await supabase
        .from("contracts")
        .insert({
          contract_number: contractNum,
          customer_id: customerId,
          product_id: finalProductId,
          status: finalize ? "active" : "draft",
          total_amount: parseFloat(totalAmount),
          down_payment: parseFloat(downPayment) || 0,
          start_date: startDate || new Date().toISOString().slice(0, 10),
          agreement_date: agreementDate || new Date().toISOString().slice(0, 10),
          planned_end_date: schedule.length > 0 ? schedule[schedule.length - 1].due_date : null,
          penalty_enabled: penaltyEnabled,
          penalty_method: mappedPenaltyMethod,
          penalty_value: penaltyEnabled ? parseFloat(penaltyValue) || 0 : 0,
          penalty_notes: penaltyNotes || null,
        })
        .select("id")
        .single();

      if (cErr || !contract) {
        throw new Error(cErr?.message || "Could not save contract. Please try again.");
      }

      // Insert schedule
      if (schedule.length > 0) {
        const { error: sErr } = await supabase.from("installment_schedules").insert(
          schedule.map((l, i) => ({
            contract_id: contract.id,
            installment_number: i + 1,
            due_date: l.due_date,
            expected_amount: parseFloat(l.amount) || 0,
            is_final_balance: l.is_final,
            status: "upcoming",
          }))
        );

        if (sErr) {
          throw new Error(sErr.message || "Contract created but failed to save installments.");
        }
      }

      // If a down payment was specified, automatically record it as an advance down payment in payments table
      const dpAmount = parseFloat(downPayment) || 0;
      if (dpAmount > 0) {
        await supabase.from("payments").insert({
          contract_id: contract.id,
          installment_id: null,
          amount: dpAmount,
          payment_date: startDate || new Date().toISOString().slice(0, 10),
          method: "cash",
          reference_number: "ADVANCE-DOWNPAYMENT",
          notes: `Advance Down Payment of AED ${dpAmount.toLocaleString("en-AE")} collected at agreement signing`,
          source: "admin_entry",
          verification_status: "not_required",
        });
      }

      router.push(`/dashboard/contracts/${contract.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const stepLabels = ["Customer & Product", "Terms & Schedule", "Penalty", "Review"];

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">New Contract</h1>
          <p className="page-subtitle">Follow the steps to create a precise installment agreement.</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="step-bar" style={{ marginBottom: 24 }}>
        {stepLabels.map((label, i) => {
          const n = (i + 1) as Step;
          const cls = n < step ? "done" : n === step ? "current" : "";
          return (
            <button key={n} type="button"
              className={`step-bar-item ${cls}`}
              onClick={() => n < step && setStep(n)}
              style={{ border: "none", cursor: n < step ? "pointer" : "default", fontFamily: "inherit" }}>
              <span className="step-num">{n < step ? "✓" : n}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {error && <div className="inline-info error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── STEP 1: Customer & Product ─────────────────────── */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Customer</p>
            <div className="field">
              <label className="field-label" htmlFor="customer-select">Select customer</label>
              <select id="customer-select" className="field-select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">— Choose customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name} ({c.customer_code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Product Type</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["car", "gold", "other"] as const).map((kind) => (
                <button key={kind} type="button"
                  onClick={() => { setProductKind(kind); setProductId(""); }}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 6, border: "1px solid",
                    background: productKind === kind ? "var(--color-accent-tint)" : "#fff",
                    borderColor: productKind === kind ? "var(--color-accent)" : "#E5E7EB",
                    color: productKind === kind ? "var(--color-accent)" : "#4B5563",
                    fontWeight: productKind === kind ? 500 : 400, fontSize: 13.5,
                    cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize",
                    transition: "all 150ms",
                  }}>
                  {kind === "other" ? "Other" : kind.charAt(0).toUpperCase() + kind.slice(1)}
                </button>
              ))}
            </div>

            {/* Car fields */}
            {productKind === "car" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  ["make", "Make", "e.g. Toyota"],
                  ["model", "Model", "e.g. Corolla"],
                  ["year", "Model Year", "e.g. 2023"],
                  ["color", "Colour", "e.g. White"],
                  ["reg", "Registration", "e.g. A-12345"],
                  ["chassis", "Chassis Number", ""],
                  ["engine", "Engine Number", ""],
                  ["ref", "Vehicle Reference", ""],
                ].map(([field, label, placeholder]) => (
                  <div key={field} className="field" style={field === "make" ? { gridColumn: "1/-1" } : {}}>
                    <label className="field-label">{label}</label>
                    <input className="field-input" type="text" placeholder={placeholder}
                      value={(car as Record<string, string>)[field]}
                      onChange={(e) => setCar((c) => ({ ...c, [field]: e.target.value }))} />
                  </div>
                ))}
              </div>
            )}

            {/* Gold fields */}
            {productKind === "gold" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  ["desc", "Description", "e.g. Gold chain", true],
                  ["type", "Gold Type", "e.g. 24K Chain"],
                  ["karat", "Karat", "e.g. 24"],
                  ["purity", "Purity", "e.g. 999"],
                  ["weight", "Weight (g)", ""],
                  ["qty", "Quantity", ""],
                  ["serial", "Serial Number", ""],
                  ["barcode", "Barcode", ""],
                  ["invoice", "Original Invoice Ref", ""],
                ].map(([field, label, placeholder, full]) => (
                  <div key={field as string} className="field" style={(full as boolean) ? { gridColumn: "1/-1" } : {}}>
                    <label className="field-label">{label as string}</label>
                    <input className="field-input" type="text" placeholder={placeholder as string}
                      value={(gold as Record<string, string>)[field as string]}
                      onChange={(e) => setGold((g) => ({ ...g, [field as string]: e.target.value }))} />
                  </div>
                ))}
              </div>
            )}

            {/* Other fields */}
            {productKind === "other" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  ["name", "Product Name", "", true],
                  ["desc", "Description", "", true],
                  ["qty", "Quantity", ""],
                  ["ref", "Reference", ""],
                ].map(([field, label, placeholder, full]) => (
                  <div key={field as string} className="field" style={(full as boolean) ? { gridColumn: "1/-1" } : {}}>
                    <label className="field-label">{label as string}</label>
                    <input className="field-input" type="text" placeholder={placeholder as string}
                      value={(other as Record<string, string>)[field as string]}
                      onChange={(e) => setOther((o) => ({ ...o, [field as string]: e.target.value }))} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="btn-primary btn-lg"
              onClick={() => { if (!customerId) { setError("Please select a customer."); return; } setError(null); setStep(2); }}>
              Next: Terms & Schedule →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Terms & Schedule ───────────────────────── */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Contract Terms</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="field" style={{ gridColumn: "1/-1" }}>
                <label className="field-label" htmlFor="total-amount">Total Amount (AED)</label>
                <input id="total-amount" className="field-input" type="number" min="0" step="0.01"
                  value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="down-payment">Down Payment (AED)</label>
                <input id="down-payment" className="field-input" type="number" min="0" step="0.01"
                  value={downPayment} onChange={(e) => setDownPayment(e.target.value)} placeholder="0.00" />
              </div>
              <div className="field">
                <label className="field-label">Financed Amount</label>
                <div style={{
                  padding: "9px 12px", borderRadius: 8, border: "1px solid #E5E7EB",
                  background: "var(--color-page)", fontSize: 14, fontWeight: 600,
                  color: "var(--color-accent)", fontVariantNumeric: "tabular-nums",
                }}>
                  {fmt(financed)}
                </div>
                <p className="field-hint">This is what the schedule must add up to.</p>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="agree-date">Agreement Date</label>
                <input id="agree-date" className="field-input" type="date"
                  value={agreementDate} onChange={(e) => setAgreementDate(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="start-date">First Payment Start Date</label>
                <input id="start-date" className="field-input" type="date"
                  value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Payment Plan</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div className="field">
                <label className="field-label" htmlFor="plan-type">Plan Type</label>
                <select id="plan-type" className="field-select"
                  value={planType} onChange={(e) => setPlanType(e.target.value as PlanType)}>
                  <option value="equal">Equal installments</option>
                  <option value="fixed_final">Fixed + final balance</option>
                  <option value="custom">Fully custom</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="num-inst">Number of Installments</label>
                <input id="num-inst" className="field-input" type="number" min="1" max="360"
                  value={numInstallments} onChange={(e) => setNumInstallments(e.target.value)} />
              </div>
            </div>
            <button type="button" className="btn-secondary" onClick={generateSchedule}>
              Generate Schedule
            </button>
          </div>

          {/* Schedule editor */}
          {schedule.length > 0 && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 600 }}>Installment Schedule</p>
                <button type="button" onClick={addLine}
                  style={{ fontSize: 12, color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  + Add row
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {schedule.map((line, i) => (
                  <div key={line.id} className="schedule-row">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "#8A9099" }}>
                        Installment #{i + 1}{line.is_final ? " · Final balance" : ""}
                      </p>
                      <button type="button" onClick={() => deleteLine(line.id)}
                        style={{ fontSize: 11, color: "#B91C1C", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                        Remove
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className="field">
                        <label className="field-label">Due date</label>
                        <input className="field-input" type="date" value={line.due_date}
                          onChange={(e) => updateLine(line.id, "due_date", e.target.value)} />
                      </div>
                      <div className="field">
                        <label className="field-label">Amount (AED)</label>
                        <input className="field-input" type="number" min="0" step="0.01" value={line.amount}
                          onChange={(e) => updateLine(line.id, "amount", e.target.value)} />
                      </div>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer" }}>
                      <input type="checkbox" checked={line.is_final}
                        onChange={(e) => updateLine(line.id, "is_final", e.target.checked)} />
                      <span style={{ fontSize: 12, color: "#4B5563" }}>Mark as final balance</span>
                    </label>
                  </div>
                ))}
              </div>

              {/* Persistent Reconciliation Bar (Section 3.3) */}
              <div className={`reconciliation-bar ${balanced ? "status-balanced" : "status-unbalanced"}`}>
                <div className="reconcile-metric">
                  <span className="reconcile-label">Financed Principal:</span>
                  <span className="reconcile-value">{fmt(financed)}</span>
                </div>
                <div className="reconcile-metric">
                  <span className="reconcile-label">Scheduled Total:</span>
                  <span className="reconcile-value">{fmt(scheduleTotal)}</span>
                </div>
                {balanced ? (
                  <div className="reconcile-status">
                    <span className="status-indicator-dot"></span>
                    <span>Schedule Balanced</span>
                  </div>
                ) : (
                  <div className="reconcile-status error">
                    <span>
                      {diff < 0
                        ? `Shortfall: ${fmt(Math.abs(diff))}`
                        : `Excess: ${fmt(diff)}`}
                    </span>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button type="button" className="btn-secondary" onClick={() => setStep(1)} style={{ height: 40, padding: "0 14px", fontSize: 13 }}>
                    ← Back
                  </button>
                  <button
                    className="btn-primary"
                    type="button"
                    disabled={!balanced}
                    style={{
                      height: 40,
                      padding: "0 18px",
                      fontSize: 13,
                      fontWeight: 500,
                      borderRadius: "var(--radius-md)",
                      backgroundColor: balanced ? "var(--primary)" : "#9CA3AF",
                      cursor: balanced ? "pointer" : "not-allowed",
                    }}
                    onClick={() => {
                      if (!balanced) {
                        setError("Schedule must be balanced before proceeding.");
                        return;
                      }
                      setError(null);
                      setStep(3);
                    }}
                  >
                    {balanced ? "Proceed to Penalty Rules →" : "Balance Required"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {schedule.length === 0 && (
            <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Penalty ────────────────────────────────── */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={penaltyEnabled} onChange={(e) => setPenaltyEnabled(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0, width: 16, height: 16 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: "#111418", marginBottom: 6 }}>Enable Extended-Term Penalty</p>
                <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.6 }}>
                  A penalty applies only if the contract runs longer than the agreed term — never because
                  an individual installment was paid a few days after its due date.
                </p>
              </div>
            </label>

            {penaltyEnabled && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #E5E7EB", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="field">
                  <label className="field-label">Penalty Method</label>
                  <select className="field-select" value={penaltyMethod} onChange={(e) => setPenaltyMethod(e.target.value)}>
                    <option value="">— Select method —</option>
                    <option value="fixed_per_month">Fixed per extended month</option>
                    <option value="percent_per_month">Percent per extended month</option>
                    <option value="custom_amount">Fixed one-time amount</option>
                    <option value="custom_rule">Custom rule</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Value (AED or %)</label>
                  <input className="field-input" type="number" min="0" step="0.01"
                    value={penaltyValue} onChange={(e) => setPenaltyValue(e.target.value)} placeholder="0.00" />
                </div>
                <div className="field" style={{ gridColumn: "1/-1" }}>
                  <label className="field-label">Notes</label>
                  <textarea className="field-textarea" rows={2}
                    value={penaltyNotes} onChange={(e) => setPenaltyNotes(e.target.value)}
                    placeholder="Any additional notes on the penalty clause" />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
            <button type="button" className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
            <button type="button" className="btn-primary btn-lg" onClick={() => { setError(null); setStep(4); }}>
              Next: Review →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Review ─────────────────────────────────── */}
      {step === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Contract Summary</p>
            <div className="def-list">
              <div>
                <p className="def-label">Customer</p>
                <p className="def-value">{customers.find((c) => c.id === customerId)?.full_name ?? "—"}</p>
              </div>
              <div>
                <p className="def-label">Product Type</p>
                <p className="def-value" style={{ textTransform: "capitalize" }}>{productKind ?? "—"}</p>
              </div>
              <div>
                <p className="def-label">Total Amount</p>
                <p className="def-value num">{fmt(parseFloat(totalAmount) || 0)}</p>
              </div>
              <div>
                <p className="def-label">Down Payment</p>
                <p className="def-value num">{fmt(parseFloat(downPayment) || 0)}</p>
              </div>
              <div>
                <p className="def-label">Financed Amount</p>
                <p className="def-value num" style={{ color: "var(--color-accent)", fontWeight: 600 }}>{fmt(financed)}</p>
              </div>
              <div>
                <p className="def-label">Installments</p>
                <p className="def-value num">{schedule.length}</p>
              </div>
              <div>
                <p className="def-label">First Due</p>
                <p className="def-value">{schedule[0]?.due_date ?? "—"}</p>
              </div>
              <div>
                <p className="def-label">Final Due</p>
                <p className="def-value">{schedule[schedule.length - 1]?.due_date ?? "—"}</p>
              </div>
              <div>
                <p className="def-label">Penalty</p>
                <p className="def-value">{penaltyEnabled ? `${penaltyMethod.replace(/_/g, " ")} — ${penaltyValue}` : "No penalty"}</p>
              </div>
            </div>
          </div>

          {/* Read-only schedule */}
          {schedule.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="card-header">
                <p className="card-title">Payment Schedule</p>
                <p style={{ fontSize: 12, color: "#8A9099" }}>{schedule.length} installments · {fmt(financed)}</p>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Due Date</th>
                    <th className="num">Amount</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((l, i) => (
                    <tr key={l.id}>
                      <td className="mono">{i + 1}</td>
                      <td>{new Date(l.due_date).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className="num">{fmt(parseFloat(l.amount) || 0)}</td>
                      <td>{l.is_final ? <span className="badge badge-neutral">Final balance</span> : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
            <button type="button" className="btn-secondary" onClick={() => setStep(3)}>← Back</button>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => save(false)} disabled={saving}>
                Save as Draft
              </button>
              <button type="button" className="btn-primary btn-lg" onClick={() => save(true)} disabled={saving}>
                {saving ? "Saving…" : "Finalise Contract"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
