"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Phone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Wallet,
  CheckCircle2,
  Coins,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

interface CustomerLedgerData {
  id: string;
  customer_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  totalAgreed: number;
  totalPaid: number;
  totalDownPayment: number;
  outstanding: number;
  paidPctFormatted: string;
  remainingPctFormatted: string;
  progressLineWidth: number;
  contracts: Array<{
    id: string;
    contract_number: string;
    status: string;
    total_amount: number;
    down_payment: number;
    product_name: string;
    schedules: Array<{
      id: string;
      installment_number: number;
      due_date: string;
      expected_amount: number;
      status: string;
    }>;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    payment_date: string;
    method: string;
    reference_number: string | null;
    verification_status: string;
    product_name?: string;
  }>;
}

interface LedgerClientProps {
  customers: CustomerLedgerData[];
  overall: {
    totalCapital: number;
    totalReceived: number;
    totalOutstanding: number;
    customerCount: number;
  };
}

const fmt = (n: number) =>
  "AED\u00A0" + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function LedgerClient({ customers, overall }: LedgerClientProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.customer_code.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Executive Portfolio Header Cards (Mobile Optimized) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-[#EAE7E0] rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF9F6] border border-[#EAE7E0] flex items-center justify-center text-[#0B1B3D]">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                Total Financed
              </span>
              <div className="text-lg sm:text-xl font-bold text-[#0B1B3D] tabular-nums mt-0.5">
                {fmt(overall.totalCapital)}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-[#64748B]">
            {overall.customerCount} Active Customer Accounts
          </div>
        </div>

        <div className="bg-white border border-[#EAE7E0] rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center text-[#16A34A]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#166534]">
                Total Received
              </span>
              <div className="text-lg sm:text-xl font-bold text-[#166534] tabular-nums mt-0.5">
                {fmt(overall.totalReceived)}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-[#166534] font-medium">
            Confirmed & Credited in Full
          </div>
        </div>

        <div className="bg-white border border-[#EAE7E0] rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFF4FA] border border-[#D1DDF0] flex items-center justify-center text-[#1E40AF]">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F4C3A]">
                Net Outstanding
              </span>
              <div className="text-lg sm:text-xl font-bold text-[#0F4C3A] tabular-nums mt-0.5">
                {fmt(overall.totalOutstanding)}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-[#0F4C3A] font-medium">
            Live Receivable Balance
          </div>
        </div>
      </div>

      {/* Live Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-[#94A3B8] absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer by name, phone or code (e.g. Junaid or 00002)..."
          className="w-full pl-11 pr-4 py-3.5 bg-white border border-[#EAE7E0] focus:border-[#0F4C3A] rounded-2xl text-sm text-[#0B1B3D] placeholder-[#94A3B8] outline-none shadow-sm transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#64748B] bg-[#F5F4EF] hover:bg-[#EAE8E2] px-2.5 py-1 rounded-lg"
          >
            Clear
          </button>
        )}
      </div>

      {/* Customer Ledgers List (Mobile First) */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white border border-[#EAE7E0] rounded-2xl p-8 text-center text-[#64748B]">
            <p className="text-sm font-medium">No customer matching &quot;{search}&quot;</p>
            <p className="text-xs text-[#94A3B8] mt-1">Try searching another name or phone number.</p>
          </div>
        ) : (
          filtered.map((c) => {
            const isExpanded = expandedId === c.id;

            return (
              <div
                key={c.id}
                className="bg-white border border-[#EAE7E0] hover:border-[#D6D2C7] rounded-2xl shadow-sm overflow-hidden transition-all duration-200"
              >
                {/* Header Row: Customer Identity & Actions */}
                <div
                  onClick={() => toggleExpand(c.id)}
                  className="p-4 sm:p-5 cursor-pointer select-none bg-white hover:bg-[#FAF9F6] transition-colors"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#FAF9F6] border border-[#EAE7E0] flex items-center justify-center font-bold text-sm text-[#0B1B3D] flex-shrink-0">
                        {c.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base sm:text-lg text-[#0B1B3D] leading-snug">
                            {c.full_name}
                          </h3>
                          <span className="font-mono text-xs font-bold text-[#0F4C3A] bg-[#EBF5F1] px-2 py-0.5 rounded-md">
                            {c.customer_code}
                          </span>
                        </div>
                        {c.phone && (
                          <div className="flex items-center gap-3 text-xs text-[#64748B] mt-1">
                            <a
                              href={`tel:${c.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 hover:text-[#0B1B3D]"
                            >
                              <Phone className="w-3.5 h-3.5 text-[#0F4C3A]" />
                              <span>{c.phone}</span>
                            </a>
                            <a
                              href={`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[#166534] font-medium hover:underline"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#0F4C3A] bg-[#FAF9F6] border border-[#EAE7E0] px-3 py-1.5 rounded-xl hidden sm:inline-block">
                        {isExpanded ? "Hide Ledger" : "View Ledger Details"}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-[#FAF9F6] flex items-center justify-center text-[#64748B]">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* 3 Prominent Executive Ledger Figures (Mobile Grid) */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 sm:p-4 bg-[#FAF9F6] border border-[#EAE7E0] rounded-xl text-center">
                    <div>
                      <span className="text-[10px] sm:text-xs font-medium text-[#64748B] block">
                        Total Agreed
                      </span>
                      <span className="text-xs sm:text-base font-bold text-[#0B1B3D] tabular-nums block mt-1">
                        {fmt(c.totalAgreed)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] sm:text-xs font-semibold text-[#166534] block">
                        Paid (Verified)
                      </span>
                      <span className="text-xs sm:text-base font-bold text-[#166534] tabular-nums block mt-1">
                        {fmt(c.totalPaid)}
                      </span>
                      {c.totalDownPayment > 0 && (
                        <span className="text-[9px] text-[#166534] font-medium block mt-0.5">
                          Incl. {fmt(c.totalDownPayment)} DP
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] sm:text-xs font-bold text-[#0F4C3A] block">
                        Remaining
                      </span>
                      <span className="text-xs sm:text-base font-extrabold text-[#0F4C3A] tabular-nums block mt-1">
                        {fmt(c.outstanding)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="mt-3">
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-[#64748B]">Settlement Progress</span>
                      <span className="font-bold text-[#0F4C3A]">
                        {c.remainingPctFormatted} remaining ({c.paidPctFormatted} paid)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-[#EAE8E2] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0F4C3A] rounded-full transition-all duration-300"
                        style={{ width: `${c.progressLineWidth}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Full Ledger Details */}
                {isExpanded && (
                  <div className="border-t border-[#EAE7E0] bg-[#FCFBF9] p-4 sm:p-6 space-y-6 animate-fadeIn">
                    {/* Agreements Breakdown */}
                    <div>
                      <h4 className="font-serif text-sm font-bold text-[#0B1B3D] uppercase tracking-wider mb-3">
                        Installment Agreements ({c.contracts.length})
                      </h4>
                      <div className="space-y-3">
                        {c.contracts.map((ct) => (
                          <div
                            key={ct.id}
                            className="bg-white border border-[#EAE7E0] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-[#0B1B3D]">
                                  {ct.product_name}
                                </span>
                                <span className="font-mono text-xs text-[#0F4C3A] font-semibold">
                                  #{ct.contract_number}
                                </span>
                              </div>
                              <div className="text-xs text-[#64748B] mt-1">
                                Total: <strong className="text-[#0B1B3D]">{fmt(ct.total_amount)}</strong>
                                {ct.down_payment > 0 && (
                                  <span> · Advance DP: <strong className="text-[#166534]">{fmt(ct.down_payment)}</strong></span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                                {ct.status.toUpperCase()}
                              </span>
                              <Link
                                href={`/dashboard/contracts/${ct.id}`}
                                className="px-3 py-1.5 text-xs font-semibold text-[#0B1B3D] bg-[#FAF9F6] border border-[#EAE7E0] hover:bg-[#EAE8E2] rounded-lg transition-colors inline-flex items-center gap-1"
                              >
                                <span>Contract</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment Ledger History */}
                    <div>
                      <h4 className="font-serif text-sm font-bold text-[#0B1B3D] uppercase tracking-wider mb-3">
                        Payment & Collection Receipts ({c.payments.length})
                      </h4>
                      {c.payments.length === 0 ? (
                        <p className="text-xs text-[#64748B] italic">No payment transactions recorded.</p>
                      ) : (
                        <div className="bg-white border border-[#EAE7E0] rounded-xl overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-[#EAE7E0] text-[#64748B] bg-[#FAF9F6] font-semibold uppercase">
                                  <th className="py-2.5 px-3.5">Amount</th>
                                  <th className="py-2.5 px-3.5">Date</th>
                                  <th className="py-2.5 px-3.5">Reference</th>
                                  <th className="py-2.5 px-3.5">Method</th>
                                  <th className="py-2.5 px-3.5 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#F5F4EF]">
                                {c.payments.map((p) => (
                                  <tr key={p.id} className="hover:bg-[#FAF9F6]">
                                    <td className="py-2.5 px-3.5 font-bold text-[#0B1B3D] tabular-nums whitespace-nowrap">
                                      {fmt(p.amount)}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-[#475569] tabular-nums whitespace-nowrap">
                                      {fmtDate(p.payment_date)}
                                    </td>
                                    <td className="py-2.5 px-3.5 font-mono text-[#0B1B3D] whitespace-nowrap">
                                      {p.reference_number || "—"}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-[#475569] capitalize whitespace-nowrap">
                                      {p.method.replace(/_/g, " ")}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                      <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                                        CREDITED
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Direct Quick Link */}
                    <div className="pt-2 flex justify-end">
                      <Link
                        href={`/dashboard/customers/${c.id}`}
                        className="text-xs font-bold text-[#0F4C3A] hover:underline inline-flex items-center gap-1.5"
                      >
                        <span>Open Complete Customer Profile & Legal File</span>
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
