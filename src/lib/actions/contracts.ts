"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function voidContract(params: {
  contractId: string;
  expectedCode: string;
  providedCode: string;
  reason?: string;
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

  if (params.providedCode.trim().toUpperCase() !== params.expectedCode.trim().toUpperCase()) {
    throw new Error("Confirmation code mismatch. Contract was not cancelled.");
  }

  const { data: before } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", params.contractId)
    .single();

  const { data, error } = await supabase
    .from("contracts")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.contractId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "contract.void",
    entity_type: "contract",
    entity_id: params.contractId,
    previous_value: before,
    new_value: { ...data, void_reason: params.reason || "Administrative void" },
  });

  revalidatePath(`/dashboard/contracts/${params.contractId}`);
  revalidatePath("/dashboard/contracts");
  revalidatePath("/dashboard");
  return data;
}

export async function deleteContract(params: { contractId: string }) {
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
    throw new Error("Insufficient permissions to delete contract");
  }

  // Fetch contract before delete for audit logging
  const { data: before } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", params.contractId)
    .single();

  if (!before) {
    throw new Error("Contract not found");
  }

  // Delete associated records first (payments, schedules, documents, agreements)
  await supabase.from("payments").delete().eq("contract_id", params.contractId);
  await supabase.from("installment_schedules").delete().eq("contract_id", params.contractId);
  await supabase.from("documents").delete().eq("contract_id", params.contractId);
  await supabase.from("agreements").delete().eq("contract_id", params.contractId);

  // Delete the contract
  const { error } = await supabase
    .from("contracts")
    .delete()
    .eq("id", params.contractId);

  if (error) {
    throw new Error(error.message);
  }

  // Record audit log
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "contract.delete",
    entity_type: "contract",
    entity_id: params.contractId,
    previous_value: before,
    new_value: null,
  });

  revalidatePath("/dashboard/contracts");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
  return { success: true };
}

