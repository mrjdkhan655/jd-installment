import type { InstallmentStatus, VerificationStatus } from "@/types/domain";

const INSTALLMENT_LABELS: Record<InstallmentStatus, { label: string; className: string }> = {
  upcoming: { label: "Upcoming", className: "badge-upcoming" },
  pending: { label: "Due", className: "badge-pending" },
  partial: { label: "Partial", className: "badge-partial" },
  paid: { label: "Paid", className: "badge-paid" },
  extended: { label: "Extended", className: "badge-overdue" },
  cancelled: { label: "Cancelled", className: "badge-upcoming" },
};

const VERIFICATION_LABELS: Record<VerificationStatus, { label: string; className: string }> = {
  not_required: { label: "Recorded", className: "badge-paid" },
  pending: { label: "Pending Review", className: "badge-pending" },
  approved: { label: "Approved", className: "badge-paid" },
  rejected: { label: "Rejected", className: "badge-overdue" },
};

export function InstallmentStatusBadge({ status }: { status: InstallmentStatus }) {
  const cfg = INSTALLMENT_LABELS[status];
  return <span className={cfg.className}>{cfg.label}</span>;
}

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  const cfg = VERIFICATION_LABELS[status];
  return <span className={cfg.className}>{cfg.label}</span>;
}
