"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const SubmitPaymentSchema = z.object({
  contractId: z.string().uuid(),
  installmentId: z.string().uuid().optional(),
  amount: z.number().positive(),
  paymentDate: z.string(), // ISO date
  method: z.enum(["cash", "bank_transfer", "online", "other"]),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  proofDocumentId: z.string().uuid().optional(),
});

/**
 * CUSTOMER submits proof of payment. This NEVER touches the official
 * ledger directly — RLS forces source='customer_submission' and
 * verification_status='pending' (see policies_customer_insert in
 * 0002_rls.sql). The balance only changes once staff approves it.
 */
export async function submitCustomerPayment(input: z.infer<typeof SubmitPaymentSchema>) {
  const parsed = SubmitPaymentSchema.parse(input);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("payments")
    .insert({
      contract_id: parsed.contractId,
      installment_id: parsed.installmentId ?? null,
      amount: parsed.amount,
      payment_date: parsed.paymentDate,
      method: parsed.method,
      reference_number: parsed.referenceNumber ?? null,
      notes: parsed.notes ?? null,
      source: "customer_submission",
      verification_status: "pending",
      submitted_by: user.id,
      proof_document_id: parsed.proofDocumentId ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/portal");
  return data;
}

/**
 * STAFF approves or rejects a pending customer submission.
 * Approval is the ONLY moment a customer-submitted payment starts
 * counting toward the official balance (see official_payments view
 * and the recalc trigger in 0003_storage_and_finance.sql).
 */
export async function reviewPaymentSubmission(params: {
  paymentId: string;
  decision: "approved" | "rejected";
  rejectionReason?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    throw new Error("Insufficient permissions");
  }

  if (params.decision === "rejected" && !params.rejectionReason) {
    throw new Error("A rejection reason is required");
  }

  const { data: before } = await supabase
    .from("payments")
    .select("*")
    .eq("id", params.paymentId)
    .single();

  const { data, error } = await supabase
    .from("payments")
    .update({
      verification_status: params.decision,
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      rejection_reason: params.decision === "rejected" ? params.rejectionReason : null,
    })
    .eq("id", params.paymentId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: `payment.${params.decision}`,
    entity_type: "payment",
    entity_id: params.paymentId,
    previous_value: before,
    new_value: data,
  });

  // When payment is approved, automatically roll over any installment shortfall to the last installment
  if (params.decision === "approved") {
    await rolloverShortfallToFinalInstallment(data.contract_id, data.installment_id);
  }

  revalidatePath("/dashboard/payments/verification");
  revalidatePath("/dashboard/installments");
  revalidatePath(`/dashboard/contracts/${data.contract_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/portal");
  revalidatePath(`/portal/contracts/${data.contract_id}`);
  return data;
}

/** STAFF records a direct payment (walk-in cash, etc.) — counts immediately. */
export async function recordAdminPayment(input: z.infer<typeof SubmitPaymentSchema>) {
  const parsed = SubmitPaymentSchema.parse(input);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    throw new Error("Insufficient permissions");
  }

  const { data, error } = await supabase
    .from("payments")
    .insert({
      contract_id: parsed.contractId,
      installment_id: parsed.installmentId ?? null,
      amount: parsed.amount,
      payment_date: parsed.paymentDate,
      method: parsed.method,
      reference_number: parsed.referenceNumber ?? null,
      notes: parsed.notes ?? null,
      source: "admin_entry",
      verification_status: "not_required",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "payment.record",
    entity_type: "payment",
    entity_id: data.id,
    new_value: data,
  });

  // Automatically roll over any installment shortfall to the last installment
  await rolloverShortfallToFinalInstallment(parsed.contractId, parsed.installmentId);

  revalidatePath("/dashboard/installments");
  revalidatePath(`/dashboard/contracts/${parsed.contractId}`);
  revalidatePath("/dashboard");
  revalidatePath("/portal");
  revalidatePath(`/portal/contracts/${parsed.contractId}`);
  return data;
}

/**
 * Automatically rolls over installment shortfalls to the final balance installment.
 * If a customer pays less than scheduled for an installment (e.g. pays 2,000 against 5,000),
 * the remaining shortfall (3,000) is automatically added to the final installment,
 * and the current installment is marked settled/paid for the amount received.
 */
export async function rolloverShortfallToFinalInstallment(
  contractId: string,
  targetInstallmentId?: string | null
) {
  const supabase = await createClient();

  // 1. Fetch all installments for this contract
  const { data: schedules, error: schedErr } = await supabase
    .from("installment_schedules")
    .select("*")
    .eq("contract_id", contractId)
    .order("installment_number", { ascending: true });

  if (schedErr || !schedules || schedules.length < 2) return;

  const finalInstallment = schedules[schedules.length - 1];

  // 2. Fetch all verified / official payments for this contract
  const { data: payments, error: payErr } = await supabase
    .from("payments")
    .select("installment_id, amount")
    .eq("contract_id", contractId)
    .in("verification_status", ["not_required", "approved"]);

  if (payErr || !payments) return;

  const paidMap = new Map<string, number>();
  payments.forEach((p) => {
    if (p.installment_id) {
      paidMap.set(p.installment_id, (paidMap.get(p.installment_id) || 0) + Number(p.amount));
    }
  });

  // 3. Inspect candidate non-final installments
  const candidateInstallments = targetInstallmentId
    ? schedules.filter((s) => s.id === targetInstallmentId && s.id !== finalInstallment.id)
    : schedules.filter((s) => s.id !== finalInstallment.id);

  let totalShortfallToRoll = 0;
  const rolloutDetails: string[] = [];

  for (const inst of candidateInstallments) {
    const paid = paidMap.get(inst.id) || 0;
    const currentExpected = Number(inst.expected_amount);

    if (paid > 0 && paid < currentExpected) {
      const shortfall = currentExpected - paid;
      totalShortfallToRoll += shortfall;

      const noteMsg = `Shortfall of AED ${shortfall.toLocaleString("en-AE")} rolled over to final installment #${finalInstallment.installment_number}.`;
      const updatedNotes = inst.notes ? `${inst.notes} | ${noteMsg}` : noteMsg;

      await supabase
        .from("installment_schedules")
        .update({
          expected_amount: paid,
          status: "paid",
          notes: updatedNotes,
        })
        .eq("id", inst.id);

      rolloutDetails.push(`Installment #${inst.installment_number} (AED ${shortfall.toLocaleString("en-AE")})`);
    }
  }

  // 4. Update the final installment with the cumulative rolled shortfall
  if (totalShortfallToRoll > 0) {
    const newFinalAmount = Number(finalInstallment.expected_amount) + totalShortfallToRoll;
    const finalNoteMsg = `Includes AED ${totalShortfallToRoll.toLocaleString("en-AE")} rolled over from: ${rolloutDetails.join(", ")}.`;
    const updatedFinalNotes = finalInstallment.notes
      ? `${finalInstallment.notes} | ${finalNoteMsg}`
      : finalNoteMsg;

    await supabase
      .from("installment_schedules")
      .update({
        expected_amount: newFinalAmount,
        notes: updatedFinalNotes,
      })
      .eq("id", finalInstallment.id);
  }
}
