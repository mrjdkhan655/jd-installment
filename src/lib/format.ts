export function formatAED(n: number | null | undefined, opts?: { compact?: boolean }) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: opts?.compact ? 0 : 2,
    minimumFractionDigits: 0,
    notation: opts?.compact ? "compact" : "standard",
  }).format(v);
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateInput(d: Date = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function monthsBetween(from: string | Date, to: string | Date) {
  const a = new Date(from);
  const b = new Date(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
