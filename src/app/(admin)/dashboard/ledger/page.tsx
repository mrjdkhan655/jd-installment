import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LedgerClient from "./LedgerClient";

export const metadata = { title: "Customer Portfolio & Ledgers — Muhammad Wahab" };

export default async function CustomerLedgersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: customers },
    { data: contracts },
    { data: officialPayments },
    { data: schedules },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, customer_code, full_name, phone, email")
      .order("created_at", { ascending: false }),
    supabase
      .from("contracts")
      .select("id, contract_number, status, total_amount, down_payment, customer_id, products(name)")
      .in("status", ["active", "draft", "extended", "completed"])
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, contract_id, amount, payment_date, method, reference_number, notes, verification_status")
      .in("verification_status", ["not_required", "approved"])
      .order("payment_date", { ascending: false }),
    supabase
      .from("installment_schedules")
      .select("id, contract_id, installment_number, due_date, expected_amount, status")
      .order("due_date", { ascending: true }),
  ]);

  let overallCapital = 0;
  let overallReceived = 0;

  const ledgerCustomers = (customers ?? []).map((cust) => {
    const custContracts = (contracts ?? []).filter((c) => c.customer_id === cust.id);
    const custContractIds = custContracts.map((c) => c.id);

    const custPayments = (officialPayments ?? []).filter((p) =>
      custContractIds.includes(p.contract_id)
    );
    const custSchedules = (schedules ?? []).filter((s) =>
      custContractIds.includes(s.contract_id)
    );

    const totalAgreed = custContracts.reduce((sum, c) => sum + Number(c.total_amount), 0);
    const totalDownPayment = custContracts.reduce((sum, c) => sum + (Number(c.down_payment) || 0), 0);

    let totalPaid = 0;
    custContracts.forEach((c) => {
      const cPayments = custPayments.filter((p) => p.contract_id === c.id);
      const rawC = cPayments.reduce((s, p) => s + Number(p.amount), 0);
      const hasDp = cPayments.some(
        (p) =>
          p.reference_number === "ADVANCE-DOWNPAYMENT" ||
          (p.notes && p.notes.toLowerCase().includes("down payment"))
      );
      const dp = Number(c.down_payment) || 0;
      totalPaid += rawC + (hasDp ? 0 : dp);
    });

    const outstanding = Math.max(0, totalAgreed - totalPaid);

    overallCapital += totalAgreed;
    overallReceived += totalPaid;

    const paidFraction = totalAgreed > 0 ? (totalPaid / totalAgreed) * 100 : 0;
    const remainingFraction = Math.max(0, 100 - paidFraction);

    const paidPctFormatted =
      paidFraction === 0
        ? "0%"
        : paidFraction < 1
        ? `${paidFraction.toFixed(1)}%`
        : Number.isInteger(paidFraction)
        ? `${paidFraction}%`
        : `${paidFraction.toFixed(1)}%`;

    const remainingPctFormatted =
      remainingFraction === 100
        ? "100%"
        : remainingFraction > 99
        ? `${remainingFraction.toFixed(1)}%`
        : Number.isInteger(remainingFraction)
        ? `${remainingFraction}%`
        : `${remainingFraction.toFixed(1)}%`;

    const progressLineWidth = totalPaid > 0 ? Math.max(2, Math.min(100, paidFraction)) : 0;

    return {
      id: cust.id,
      customer_code: cust.customer_code,
      full_name: cust.full_name,
      phone: cust.phone,
      email: cust.email,
      totalAgreed,
      totalPaid,
      totalDownPayment,
      outstanding,
      paidPctFormatted,
      remainingPctFormatted,
      progressLineWidth,
      contracts: custContracts.map((c) => ({
        id: c.id,
        contract_number: c.contract_number,
        status: c.status,
        total_amount: Number(c.total_amount),
        down_payment: Number(c.down_payment) || 0,
        product_name: (c.products as any)?.name || "Financed Asset",
        schedules: custSchedules.filter((s) => s.contract_id === c.id),
      })),
      payments: custPayments.map((p) => {
        const matchingContract = custContracts.find((c) => c.id === p.contract_id);
        return {
          id: p.id,
          amount: Number(p.amount),
          payment_date: p.payment_date,
          method: p.method,
          reference_number: p.reference_number,
          verification_status: p.verification_status,
          product_name: (matchingContract?.products as any)?.name,
        };
      }),
    };
  });

  const overallOutstanding = Math.max(0, overallCapital - overallReceived);

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#166534]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#166534]">
            Executive Monitoring
          </span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0B1B3D]">
          Customer Portfolio Ledgers
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B] mt-1">
          Complete mobile-optimized directory: Real-time receivables, verified collections, and active client balances.
        </p>
      </div>

      <LedgerClient
        customers={ledgerCustomers}
        overall={{
          totalCapital: overallCapital,
          totalReceived: overallReceived,
          totalOutstanding: overallOutstanding,
          customerCount: ledgerCustomers.length,
        }}
      />
    </div>
  );
}
