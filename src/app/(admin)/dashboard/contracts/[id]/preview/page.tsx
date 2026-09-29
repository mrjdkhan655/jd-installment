import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { formatAED, formatDate, monthsBetween } from "@/lib/format";
import { PrintAgreementButton } from "@/components/agreements/PrintAgreementButton";

export const metadata = { title: "Agreement Preview — InstallPro" };

const TITLES: Record<string, string> = {
  car: "VEHICLE SALE & INSTALLMENT AGREEMENT",
  gold: "GOLD SALE & INSTALLMENT AGREEMENT",
  other: "PRODUCT SALE & INSTALLMENT AGREEMENT",
};

export default async function ContractAgreementPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select("*, customers(*), products(*, cars(*), gold_assets(*), other_products(*))")
    .eq("id", id)
    .maybeSingle();

  if (!contract) notFound();

  const { data: schedule } = await supabase
    .from("installment_schedules")
    .select("*")
    .eq("contract_id", id)
    .order("installment_number");

  const { data: settings } = await supabase
    .from("business_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const product = contract.products as any;
  const customer = contract.customers as any;
  const kind = product?.kind ?? "other";

  const asset: { label: string; value: string }[] = [];
  if (kind === "car" && product.cars) {
    const c = product.cars;
    asset.push(
      { label: "Make", value: c.make ?? "—" },
      { label: "Model", value: c.model ?? "—" },
      { label: "Model Year", value: c.model_year ? String(c.model_year) : "—" },
      { label: "Colour", value: c.color ?? "—" },
      { label: "Registration No.", value: c.registration_number ?? "—" },
      { label: "Chassis No.", value: c.chassis_number ?? "—" },
      { label: "Engine No.", value: c.engine_number ?? "—" }
    );
  } else if (kind === "gold" && product.gold_assets) {
    const g = product.gold_assets;
    asset.push(
      { label: "Description", value: g.description ?? "—" },
      { label: "Gold Type", value: g.gold_type ?? "—" },
      { label: "Karat", value: g.karat ?? "—" },
      { label: "Purity", value: g.purity ?? "—" },
      { label: "Weight", value: g.weight_grams ? `${g.weight_grams} grams` : "—" },
      { label: "Quantity", value: String(g.quantity ?? 1) },
      { label: "Serial Number", value: g.serial_number ?? "—" },
      { label: "Barcode / Reference", value: g.barcode ?? "—" }
    );
  } else {
    const o = product?.other_products;
    asset.push(
      { label: "Product", value: product?.name ?? "—" },
      { label: "Description", value: o?.description ?? "—" },
      { label: "Quantity", value: String(o?.quantity ?? 1) },
      { label: "Reference", value: product?.reference_number ?? "—" }
    );
  }

  let penaltyClause =
    "No extended-term penalty applies to this agreement. The Buyer is not charged any additional amount for variation in individual payment dates.";
  if (contract.penalty_enabled) {
    const v = Number(contract.penalty_value ?? 0);
    const detail =
      contract.penalty_method === "fixed_per_month"
        ? `${formatAED(v)} for each month by which the contract term is extended`
        : contract.penalty_method === "percent_per_month"
        ? `${v}% of the total agreed amount for each month by which the contract term is extended`
        : contract.penalty_method === "custom_amount"
        ? `a one-time amount of ${formatAED(v)}`
        : "an amount determined by the Seller in accordance with the agreed custom rule";
    penaltyClause = `Should the Buyer extend the overall duration of this contract beyond the agreed term, an extended-term charge of ${detail} shall apply. This charge relates solely to extension of the contract duration and is not triggered by variation in the date of any individual installment.`;
  }

  const financed = Number(contract.total_amount) - Number(contract.down_payment);
  const lines = schedule ?? [];
  const months = contract.planned_end_date
    ? monthsBetween(contract.start_date, contract.planned_end_date)
    : lines.length;

  const agreementDate = formatDate(contract.agreement_date ?? contract.created_at);
  const totalAmountStr = formatAED(contract.total_amount);
  const downPaymentStr = formatAED(contract.down_payment);
  const financedStr = formatAED(financed);
  const durationLabel = `${months} month${months === 1 ? "" : "s"} (${lines.length} installments)`;
  const startDateStr = formatDate(contract.start_date);
  const endDateStr = formatDate(contract.planned_end_date);

  const assetNoun = kind === "car" ? "vehicle" : kind === "gold" ? "gold item(s)" : "product";
  const terms = [
    `The Seller agrees to sell and the Buyer agrees to purchase the ${assetNoun} described above for the total agreed amount of ${totalAmountStr}.`,
    `The Buyer shall pay the financed amount of ${financedStr} in accordance with the payment schedule set out in this agreement.`,
    `Payments may be made by cash, bank transfer, or online payment. The Buyer must retain proof of every payment made.`,
    `The agreed duration of this contract is ${durationLabel}, commencing ${startDateStr} and scheduled for completion on ${endDateStr}.`,
    `Reasonable flexibility is permitted in the exact calendar date on which each installment is paid. A payment made shortly after its scheduled date does not, by itself, constitute a breach of this agreement or attract any penalty.`,
    penaltyClause,
    `Partial payments are accepted and will be credited against the relevant installment. Any shortfall remains outstanding until settled in full.`,
    `Ownership of the ${assetNoun} transfers to the Buyer upon full and final settlement of all amounts due under this agreement.`,
    `The Buyer is responsible for the care and safekeeping of the ${assetNoun} from the date of delivery.`,
    `This agreement constitutes the entire understanding between the parties and supersedes any prior arrangement, whether written or verbal.`,
    `Both parties confirm that they have read, understood, and accepted all terms set out above.`,
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-16">
      {/* Top Action Toolbar (hidden on print) */}
      <div className="print:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3.5 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/contracts/${contract.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-2.5 py-1.5 bg-white transition-colors"
            >
              ← Back to Contract
            </Link>
            <span className="font-mono text-xs font-semibold text-[#0F4C3A] bg-[#EAF3EF] px-2 py-0.5 rounded">
              #{contract.contract_number}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={`/api/agreements/${contract.id}?download=true`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF File
            </a>
            <PrintAgreementButton />
          </div>
        </div>
      </div>

      {/* Printable Sheet Container */}
      <div className="max-w-4xl mx-auto mt-6 px-4 print:p-0 print:m-0 print:max-w-none">
        <article className="bg-white rounded-lg border border-gray-200 shadow-sm p-10 print:border-none print:shadow-none print:p-8 text-[#111418] text-[13px] leading-relaxed font-sans">
          {/* Brand Logo & Header */}
          <div className="text-center pb-4 border-b border-gray-200 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt={settings?.business_name ?? "Muhammad Wahab"}
              className="h-16 mx-auto object-contain mb-3"
            />
            <p className="text-xs uppercase tracking-widest text-[#0F4C3A] font-bold mb-1">
              {settings?.business_name ?? "Muhammad Wahab"} · Official Installment Contract
            </p>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              {TITLES[kind] ?? "SALE & INSTALLMENT AGREEMENT"}
            </h1>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Contract Reference: #{contract.contract_number}
            </p>
          </div>

          {/* Meta Info Strip */}
          <div className="flex justify-between items-center text-xs text-gray-600 pb-3 border-b border-gray-200 mb-6">
            <div>
              <span className="text-gray-400">Date:</span>{" "}
              <span className="font-medium text-gray-800">{agreementDate}</span>
            </div>
            <div>
              <span className="text-gray-400">Jurisdiction / Location:</span>{" "}
              <span className="font-medium text-gray-800">{settings?.business_address ?? "Dubai, UAE"}</span>
            </div>
          </div>

          {/* Parties Section */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div className="bg-[#F7F8FA] p-4 rounded border border-gray-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F4C3A] mb-3">
                First Party (Seller)
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Business Name:</span>
                  <span className="font-semibold text-gray-900">{settings?.business_name ?? "Seller LLC"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Address:</span>
                  <span className="text-gray-800">{settings?.business_address ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone:</span>
                  <span className="text-gray-800">{settings?.business_phone ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Email:</span>
                  <span className="text-gray-800">{settings?.business_email ?? "—"}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#F7F8FA] p-4 rounded border border-gray-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F4C3A] mb-3">
                Second Party (Buyer)
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Full Name:</span>
                  <span className="font-semibold text-gray-900">{customer?.full_name ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer Code:</span>
                  <span className="font-mono text-gray-800">{customer?.customer_code ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Emirates ID / Passport:</span>
                  <span className="font-mono text-gray-800">{customer?.government_id ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone:</span>
                  <span className="text-gray-800">{customer?.phone ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Address:</span>
                  <span className="text-gray-800">{customer?.address ?? "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Asset Specification */}
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F4C3A] mb-2 pb-1 border-b border-gray-200">
              Asset Specification
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-white p-3 rounded border border-gray-100">
              {asset.map((a) => (
                <div key={a.label}>
                  <span className="text-gray-400 block text-[11px]">{a.label}</span>
                  <span className="font-semibold text-gray-900">{a.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Agreement Financial Valuation */}
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F4C3A] mb-2 pb-1 border-b border-gray-200">
              Agreement Duration & Valuation
            </h3>
            <div className="grid grid-cols-3 gap-4 text-xs bg-[#F7F8FA] p-4 rounded border border-gray-100">
              <div>
                <span className="text-gray-500 block text-[11px]">Total Agreed Price</span>
                <span className="text-sm font-bold text-gray-900 tabular-nums">{totalAmountStr}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px]">Down Payment Received</span>
                <span className="text-sm font-bold text-gray-900 tabular-nums">{downPaymentStr}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px]">Financed Balance</span>
                <span className="text-sm font-bold text-[#0F4C3A] tabular-nums">{financedStr}</span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <span className="text-gray-500 block text-[11px]">Duration</span>
                <span className="font-medium text-gray-900">{durationLabel}</span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <span className="text-gray-500 block text-[11px]">Start Date</span>
                <span className="font-medium text-gray-900">{startDateStr}</span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <span className="text-gray-500 block text-[11px]">Scheduled Completion</span>
                <span className="font-medium text-gray-900">{endDateStr}</span>
              </div>
            </div>
          </div>

          {/* Payment Schedule Table */}
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F4C3A] mb-2 pb-1 border-b border-gray-200">
              Payment Schedule
            </h3>
            <div className="overflow-hidden border border-gray-200 rounded">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F7F8FA] text-gray-700 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-2 px-3 w-12 text-center">#</th>
                    <th className="py-2 px-3">Due Date</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Amount Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Number(contract.down_payment) > 0 && (
                    <tr className="bg-emerald-50/60 font-medium">
                      <td className="py-2 px-3 text-center text-emerald-800 font-bold">#0</td>
                      <td className="py-2 px-3 font-semibold text-emerald-900">{startDateStr}</td>
                      <td className="py-2 px-3 text-emerald-800">
                        Advance Down Payment (Paid / Credited at Signing)
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-900 tabular-nums">
                        {downPaymentStr}
                      </td>
                    </tr>
                  )}
                  {lines.map((l: any) => (
                    <tr key={l.installment_number} className="hover:bg-gray-50">
                      <td className="py-1.5 px-3 text-center text-gray-500">{l.installment_number}</td>
                      <td className="py-1.5 px-3 font-medium text-gray-900">{formatDate(l.due_date)}</td>
                      <td className="py-1.5 px-3 text-gray-600">
                        {l.is_final_balance ? "Final balance settlement" : "Scheduled installment"}
                      </td>
                      <td className="py-1.5 px-3 text-right font-semibold text-gray-900 tabular-nums">
                        {formatAED(l.expected_amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#F7F8FA] font-bold border-t-2 border-gray-300">
                    <td colSpan={3} className="py-2 px-3 text-right text-gray-900">
                      Total Financed Amount:
                    </td>
                    <td className="py-2 px-3 text-right text-[#0F4C3A] tabular-nums text-sm">
                      {financedStr}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Terms of Sale */}
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F4C3A] mb-2 pb-1 border-b border-gray-200">
              Terms & Conditions
            </h3>
            <ol className="space-y-1.5 text-xs text-gray-700 pl-4 list-decimal">
              {terms.map((t, idx) => (
                <li key={idx} className="leading-relaxed">
                  {t}
                </li>
              ))}
            </ol>
          </div>

          {/* Notes */}
          {contract.notes ? (
            <div className="mb-8 bg-gray-50 p-3.5 rounded border border-gray-200">
              <span className="text-xs font-bold text-gray-700 block mb-1">Additional Notes:</span>
              <p className="text-xs text-gray-600 whitespace-pre-wrap">{contract.notes}</p>
            </div>
          ) : null}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 pt-8 mt-8 border-t border-gray-200">
            <div>
              <div className="h-16 border-b border-gray-800"></div>
              <div className="mt-2 text-xs">
                <p className="font-bold text-gray-900">Seller Representative</p>
                <p className="text-gray-500">{settings?.business_name ?? "Seller"}</p>
                <p className="text-gray-400 mt-1">Date: ________________________</p>
              </div>
            </div>

            <div>
              <div className="h-16 border-b border-gray-800"></div>
              <div className="mt-2 text-xs">
                <p className="font-bold text-gray-900">Buyer</p>
                <p className="text-gray-500">{customer?.full_name ?? "Buyer"}</p>
                <p className="text-gray-400 mt-1">Date: ________________________</p>
              </div>
            </div>
          </div>

          {/* Footer watermark */}
          <div className="mt-12 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 font-mono">
            InstallPro Official Agreement · #{contract.contract_number} · Generated on {agreementDate}
          </div>
        </article>
      </div>

      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          nav, aside, header, .print\\:hidden {
            display: none !important;
          }
          article {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
