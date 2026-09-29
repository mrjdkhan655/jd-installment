export type AppRole = "super_admin" | "admin" | "customer";
export type ProductKind = "car" | "gold" | "other";
export type ContractStatus = "draft" | "active" | "completed" | "extended" | "cancelled";
export type InstallmentStatus = "upcoming" | "pending" | "partial" | "paid" | "extended" | "cancelled";
export type PaymentMethod = "cash" | "bank_transfer" | "online" | "other";
export type PaymentSource = "admin_entry" | "customer_submission";
export type VerificationStatus = "not_required" | "pending" | "approved" | "rejected";
export type PenaltyMethod = "fixed_per_month" | "percent_per_month" | "custom_amount" | "custom_rule";

export interface InstallmentLine {
  installmentNumber: number;
  dueDate: string; // ISO date
  expectedAmount: number;
  isFinalBalance: boolean;
  notes?: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  customerId: string;
  productId: string;
  status: ContractStatus;
  totalAmount: number;
  downPayment: number;
  agreementDate: string | null;
  startDate: string;
  plannedEndDate: string | null;
  actualEndDate: string | null;
  penaltyEnabled: boolean;
  penaltyMethod: PenaltyMethod | null;
  penaltyValue: number | null;
}

export interface ContractFinancialSummary {
  totalAmount: number;
  totalPaid: number;
  outstanding: number;
  pendingSubmissions: number;
}
