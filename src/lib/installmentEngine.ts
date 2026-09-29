/**
 * INSTALLMENT ENGINE
 * --------------------------------------------------------------
 * Pure, deterministic, framework-free schedule generation.
 * The admin always gets a chance to review/edit the generated
 * lines before a contract is finalized (see ScheduleEditor.tsx).
 *
 * This module never talks to the database — it only produces
 * InstallmentLine[] that the caller persists.
 */
import { addMonths, addYears, formatISO } from "date-fns";
import type { InstallmentLine } from "@/types/domain";

export type ScheduleFrequency = "monthly" | "yearly" | "custom";

interface FixedPlanInput {
  mode: "fixed_with_final_balance" | "fixed_exact";
  totalAmount: number;
  downPayment: number;
  installmentAmount: number;
  frequency: ScheduleFrequency;
  startDate: string; // ISO
  termCount: number; // number of installments (excluding down payment)
}

interface CustomPlanInput {
  mode: "custom";
  startDate: string;
  frequency: ScheduleFrequency;
  amounts: number[]; // one entry per installment, in order
  totalAmount: number;
  downPayment: number;
  finalIsRemainingBalance: boolean;
}

export type PlanInput = FixedPlanInput | CustomPlanInput;

function stepDate(iso: string, frequency: ScheduleFrequency, steps: number): string {
  const base = new Date(iso);
  const d = frequency === "yearly" ? addYears(base, steps) : addMonths(base, steps);
  return formatISO(d, { representation: "date" });
}

/**
 * Generates a schedule. Financed amount = totalAmount - downPayment.
 *
 * "fixed_with_final_balance": pay `installmentAmount` each period; the
 *   LAST installment absorbs whatever remains (handles cases like
 *   AED 100,000 total, AED 5,000/mo not dividing evenly, or a
 *   deliberate balloon final payment).
 *
 * "fixed_exact": exactly totalAmount / termCount per period (must divide
 *   evenly, otherwise throws — use fixed_with_final_balance instead).
 *
 * "custom": admin supplies an explicit amount per installment; if
 *   finalIsRemainingBalance is true the last entry is overwritten with
 *   whatever balance remains after the earlier lines.
 */
export function generateSchedule(input: PlanInput): InstallmentLine[] {
  const financed = round2(input.totalAmount - input.downPayment);
  if (financed < 0) throw new Error("Down payment cannot exceed total amount");

  if (input.mode === "custom") {
    const lines: InstallmentLine[] = [];
    let runningPaidPlan = 0;
    input.amounts.forEach((amt, idx) => {
      const isLast = idx === input.amounts.length - 1;
      let expected = amt;
      if (isLast && input.finalIsRemainingBalance) {
        expected = round2(financed - runningPaidPlan);
      }
      runningPaidPlan = round2(runningPaidPlan + expected);
      lines.push({
        installmentNumber: idx + 1,
        dueDate: stepDate(input.startDate, input.frequency, idx),
        expectedAmount: expected,
        isFinalBalance: isLast && input.finalIsRemainingBalance,
      });
    });
    return lines;
  }

  // fixed plans
  const { termCount, installmentAmount } = input;
  if (termCount < 1) throw new Error("Term count must be at least 1");

  if (input.mode === "fixed_exact") {
    const exact = round2(financed / termCount);
    const totalCheck = round2(exact * termCount);
    if (Math.abs(totalCheck - financed) > 0.01) {
      throw new Error(
        "Amount does not divide evenly across the term — use fixed_with_final_balance instead"
      );
    }
    return Array.from({ length: termCount }, (_, idx) => ({
      installmentNumber: idx + 1,
      dueDate: stepDate(input.startDate, input.frequency, idx),
      expectedAmount: exact,
      isFinalBalance: false,
    }));
  }

  // fixed_with_final_balance
  const lines: InstallmentLine[] = [];
  let remaining = financed;
  for (let i = 0; i < termCount; i++) {
    const isLast = i === termCount - 1;
    const amount = isLast ? round2(remaining) : Math.min(installmentAmount, round2(remaining));
    lines.push({
      installmentNumber: i + 1,
      dueDate: stepDate(input.startDate, input.frequency, i),
      expectedAmount: amount,
      isFinalBalance: isLast,
    });
    remaining = round2(remaining - amount);
  }
  return lines;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ----------------------------------------------------------------
// PENALTY ENGINE — extended-TERM based, never calendar-lateness based
// ----------------------------------------------------------------
export interface PenaltyConfig {
  enabled: boolean;
  method: "fixed_per_month" | "percent_per_month" | "custom_amount" | "custom_rule" | null;
  value: number | null; // fixed AED amount, or percent (e.g. 2 = 2%)
}

/**
 * Computes penalty based on how many months the contract's ACTUAL
 * completion extended beyond its ORIGINAL planned term — never based
 * on individual installments being paid a few days/weeks late.
 *
 * plannedMonths: the term the contract was originally agreed for.
 * actualMonths: how long it actually took to fully settle (rounded up
 *   to the nearest whole month is a reasonable business convention;
 *   pass the value your admin UI computes).
 * totalAmount: needed only for percent_per_month method.
 */
export function calculateExtendedTermPenalty(params: {
  config: PenaltyConfig;
  plannedMonths: number;
  actualMonths: number;
  totalAmount: number;
}): { extendedMonths: number; penaltyAmount: number } {
  const { config, plannedMonths, actualMonths, totalAmount } = params;
  const extendedMonths = Math.max(0, Math.ceil(actualMonths - plannedMonths));

  if (!config.enabled || extendedMonths <= 0 || config.value == null) {
    return { extendedMonths, penaltyAmount: 0 };
  }

  switch (config.method) {
    case "fixed_per_month":
      return { extendedMonths, penaltyAmount: round2(config.value * extendedMonths) };
    case "percent_per_month":
      return {
        extendedMonths,
        penaltyAmount: round2(((config.value / 100) * totalAmount) * extendedMonths),
      };
    case "custom_amount":
      // flat, one-time custom amount regardless of extended-month count
      return { extendedMonths, penaltyAmount: round2(config.value) };
    default:
      // custom_rule: business defines this manually per-contract; the
      // system surfaces extendedMonths so the admin can key in the
      // final penalty amount themselves.
      return { extendedMonths, penaltyAmount: 0 };
  }
}
