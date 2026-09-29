import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteCustomerButton } from "@/components/customers/DeleteCustomerButton";
import { DeleteContractButton } from "@/components/contracts/DeleteContractButton";
import { CustomerAuthCard } from "@/components/customers/CustomerAuthCard";

export const metadata = { title: "Customer Account — InstallPro" };

const fmt = (n: number) =>
  "AED\u00A0" +
  n.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const resolvedParams = await params;
  const customerId = resolvedParams.id;

  // Fetch customer profile
  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (error || !customer) {
    notFound();
  }

  // Fetch all contracts for this customer
  const { data: contracts } = await supabase
    .from("contracts")
    .select(`
      id,
      contract_number,
      status,
      total_amount,
      down_payment,
      start_date,
      planned_end_date,
      products (
        name,
        kind
      )
    `)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  // Fetch all payments for this customer
  const { data: payments } = await supabase
    .from("payments")
    .select(`
      id,
      amount,
      payment_date,
      method,
      reference_number,
      verification_status,
      contracts (
        contract_number
      )
    `)
    .eq("customer_id", customerId)
    .order("payment_date", { ascending: false });

  // Compute financial totals
  const totalContractValue = (contracts ?? []).reduce(
    (s, c) => s + (c.total_amount ?? 0),
    0
  );

  const officialPayments = (payments ?? []).filter(
    (p) => p.verification_status === "approved" || p.verification_status === "not_required"
  );

  const totalPaid = officialPayments.reduce((s, p) => s + p.amount, 0);
  const netOutstanding = Math.max(0, totalContractValue - totalPaid);

  const pendingPayments = (payments ?? []).filter(
    (p) => p.verification_status === "pending"
  );
  const pendingTotal = pendingPayments.reduce((s, p) => s + p.amount, 0);
  const activeContracts = (contracts ?? []).filter((c) => c.status === "active").length;

  return (
    <div className="fade-in space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/dashboard/customers" className="hover:text-gray-900 transition-colors">
              Customers
            </Link>
            <span>/</span>
            <span className="font-mono text-gray-800 font-medium">{customer.customer_code}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              {customer.full_name}
            </h1>
            <span className={`badge ${customer.is_active ? "badge-paid" : "badge-neutral"}`}>
              {customer.is_active ? "Active Client" : "Archived"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/contracts/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white rounded-md transition-colors shadow-sm"
            style={{ backgroundColor: "var(--primary)" }}
          >
            + Create New Contract
          </Link>
          <DeleteCustomerButton
            customerId={customer.id}
            customerName={customer.full_name}
            customerCode={customer.customer_code}
            redirectAfterDelete={true}
            label="Delete Account"
            variant="danger-outline"
          />
        </div>
      </div>

      {/* Financial Status Header Strip (Section 3.4 Pattern) */}
      <div className="financial-balance-strip">
        <div className="balance-cell">
          <span className="cell-label">Total Contract Value</span>
          <span className="cell-val">{fmt(totalContractValue)}</span>
        </div>
        <div className="balance-cell">
          <span className="cell-label">Confirmed Received</span>
          <span className="cell-val color-confirmed">{fmt(totalPaid)}</span>
        </div>
        <div className="balance-cell">
          <span className="cell-label">Net Outstanding</span>
          <span className="cell-val color-outstanding">{fmt(netOutstanding)}</span>
        </div>
        <div className="balance-cell unverified-warning-box">
          <span className="cell-label">Pending Verification</span>
          <span className="cell-val color-pending">{fmt(pendingTotal)}</span>
          <span className="cell-subtext">
            {pendingPayments.length > 0 ? `${pendingPayments.length} submission(s) unverified` : "No pending submissions"}
          </span>
        </div>
      </div>

      {/* 2-Column Split: Customer Profile & Identification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact & Personal Identity */}
        <div className="card p-5 bg-white border border-gray-200 rounded-lg">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
            Identity & Contact Details
          </h2>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Legal Name:</span>
              <span className="font-semibold text-gray-900">{customer.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Account ID:</span>
              <span className="font-mono text-gray-700">{customer.customer_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phone Number:</span>
              <span className="tabular-nums text-gray-900 font-medium">{customer.phone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Government ID / EID:</span>
              <span className="font-mono text-gray-900">{customer.government_id || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email Address:</span>
              <span className="text-gray-800">{customer.email || "—"}</span>
            </div>
          </div>
        </div>

        {/* Address & Portfolio Notes */}
        <div className="card p-5 bg-white border border-gray-200 rounded-lg">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
            Location & Ledger Notes
          </h2>
          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-gray-500 block mb-1">Residential Address:</span>
              <p className="text-gray-900 leading-relaxed bg-gray-50 p-2 rounded border border-gray-100">
                {customer.address || "No permanent address registered on file."}
              </p>
            </div>
            <div>
              <span className="text-gray-500 block mb-1">Internal Notes:</span>
              <p className="text-gray-700 leading-relaxed bg-gray-50 p-2 rounded border border-gray-100">
                {customer.notes || "No special credit remarks recorded."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Portal Login & Access Card */}
      <CustomerAuthCard
        customerId={customer.id}
        customerName={customer.full_name}
        customerCode={customer.customer_code}
        hasAuthAccount={Boolean(customer.auth_user_id)}
      />

      {/* Customer's Contracts Table */}
      <div className="card bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Contract Agreements ({contracts?.length ?? 0})
            </h2>
            <p className="text-xs text-gray-500">
              Active and completed installment schedules linked to this account.
            </p>
          </div>
          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
            {activeContracts} Active
          </span>
        </div>

        {!contracts || contracts.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            No contracts recorded for this customer yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[11px] tracking-wider">
                  <th className="py-2.5 px-4 font-medium">Contract Ref</th>
                  <th className="py-2.5 px-4 font-medium">Financed Asset</th>
                  <th className="py-2.5 px-4 font-medium">Start Date</th>
                  <th className="py-2.5 px-4 font-medium text-center">Status</th>
                  <th className="py-2.5 px-4 font-medium text-right">Total Financed</th>
                  <th className="py-2.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {contracts.map((c) => {
                  const product = c.products as any;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-800">
                        <Link href={`/dashboard/contracts/${c.id}`} className="hover:underline">
                          {c.contract_number}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-900 font-medium">
                        {product?.name || "Asset"}
                        {product?.kind ? (
                          <span className="block text-[11px] text-gray-500 capitalize">
                            Type: {product.kind}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-gray-600 tabular-nums">
                        {fmtDate(c.start_date)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`badge badge-${c.status}`}>
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-gray-900">
                        {fmt(c.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/contracts/${c.id}`}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                          >
                            View Ledger →
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
        )}
      </div>

      {/* Customer's Recent Payment Transactions */}
      <div className="card bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Payment History & Audit Status
          </h2>
          <p className="text-xs text-gray-500">
            Direct ledger payments and customer submitted receipts.
          </p>
        </div>

        {!payments || payments.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            No payments recorded on this customer account yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[11px] tracking-wider">
                  <th className="py-2.5 px-4 font-medium">Payment Date</th>
                  <th className="py-2.5 px-4 font-medium">Contract Ref</th>
                  <th className="py-2.5 px-4 font-medium">Method</th>
                  <th className="py-2.5 px-4 font-medium">Reference #</th>
                  <th className="py-2.5 px-4 font-medium text-center">Verification</th>
                  <th className="py-2.5 px-4 font-medium text-right">Amount Credited</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((p) => {
                  const contract = p.contracts as any;
                  const isVerified = p.verification_status === "approved" || p.verification_status === "not_required";
                  const isPending = p.verification_status === "pending";

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4 tabular-nums text-gray-900 font-medium">
                        {fmtDate(p.payment_date)}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600">
                        {contract?.contract_number || "—"}
                      </td>
                      <td className="py-3 px-4 capitalize text-gray-700">
                        {p.method?.replace(/_/g, " ") || "Cash"}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-500">
                        {p.reference_number || "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`badge ${
                            isVerified
                              ? "badge-paid"
                              : isPending
                              ? "badge-pending"
                              : "badge-overdue"
                          }`}
                        >
                          {isVerified ? "Audited / Paid" : isPending ? "Pending Audit" : "Rejected"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-gray-900">
                        {fmt(p.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dangerous Administrative Actions: Delete Customer Account */}
      <div className="card p-5 bg-white border border-red-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-red-900">
            Danger Zone · Delete Customer Profile
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Permanently delete this customer account, associated portal credentials, contracts, and payments.
          </p>
        </div>
        <DeleteCustomerButton
          customerId={customer.id}
          customerName={customer.full_name}
          customerCode={customer.customer_code}
          redirectAfterDelete={true}
          label="Delete Customer Account"
          variant="button"
        />
      </div>
    </div>
  );
}
