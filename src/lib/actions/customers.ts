"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const CreateCustomerSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().email().optional().or(z.literal("")),
  governmentId: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  password: z.string().optional(),
});

function generateTempPassword(): string {
  // 10-char readable temp password: avoids ambiguous chars (0/O, 1/l)
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function nextCustomerCode(): Promise<string> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true });
  const n = (count ?? 0) + 1;
  return `CUST-${String(n).padStart(5, "0")}`;
}

/**
 * Creates a customer record AND a real Supabase Auth login for them,
 * using a synthetic email (customerCode@login.internal) so the
 * customer can sign in using their customer username (e.g. cust-00001).
 * Returns the generated username/password for the admin to hand to the customer.
 */
export async function createCustomer(input: z.infer<typeof CreateCustomerSchema>) {
  const parsed = CreateCustomerSchema.parse(input);

  const supabase = await createClient();
  const {
    data: { user: actingUser },
  } = await supabase.auth.getUser();
  if (!actingUser) throw new Error("Not authenticated");

  const { data: actingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", actingUser.id)
    .single();
  if (!actingProfile || !["super_admin", "admin"].includes(actingProfile.role)) {
    throw new Error("Insufficient permissions");
  }

  const customerCode = await nextCustomerCode();
  const username = customerCode.toLowerCase();
  const loginEmail = `${username}@login.internal`;
  const passwordToUse = parsed.password?.trim() || generateTempPassword();

  // Elevated privilege needed to create an auth user on the admin's behalf.
  const admin = createServiceRoleClient();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: loginEmail,
    password: passwordToUse,
    email_confirm: true,
    user_metadata: { role: "customer", customer_code: customerCode },
  });
  if (authError || !authUser?.user) {
    throw new Error(authError?.message ?? "Failed to create login for customer");
  }

  // profile row (role=customer) for the new auth user
  await admin.from("profiles").insert({
    id: authUser.user.id,
    role: "customer",
    full_name: parsed.fullName,
    phone: parsed.phone,
    email: parsed.email || null,
    created_by: actingUser.id,
  });

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      customer_code: customerCode,
      auth_user_id: authUser.user.id,
      full_name: parsed.fullName,
      phone: parsed.phone,
      email: parsed.email || null,
      government_id: parsed.governmentId || null,
      address: parsed.address || null,
      notes: parsed.notes || null,
      created_by: actingUser.id,
    })
    .select()
    .single();

  if (customerError) {
    // best-effort rollback of the auth user if the customer row failed
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(customerError.message);
  }

  await admin.from("audit_logs").insert({
    actor_id: actingUser.id,
    action: "customer.create",
    entity_type: "customer",
    entity_id: customer.id,
    new_value: customer,
  });

  revalidatePath("/dashboard/customers");

  return {
    customer,
    credentials: {
      username,
      customerCode,
      tempPassword: passwordToUse,
      loginEmail,
    },
  };
}

export async function createOrResetCustomerAuth(params: {
  customerId: string;
  customPassword?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user: actingUser },
  } = await supabase.auth.getUser();
  if (!actingUser) throw new Error("Not authenticated");

  const { data: actingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", actingUser.id)
    .single();
  if (!actingProfile || !["super_admin", "admin"].includes(actingProfile.role)) {
    throw new Error("Insufficient permissions");
  }

  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("*")
    .eq("id", params.customerId)
    .single();

  if (custErr || !customer) {
    throw new Error("Customer not found");
  }

  const admin = createServiceRoleClient();
  const username = customer.customer_code.toLowerCase();
  const loginEmail = `${username}@login.internal`;
  const passwordToUse = params.customPassword?.trim() || generateTempPassword();

  if (customer.auth_user_id) {
    // Update existing user password
    const { error: updateErr } = await admin.auth.admin.updateUserById(customer.auth_user_id, {
      password: passwordToUse,
    });
    if (updateErr) {
      throw new Error(updateErr.message);
    }
  } else {
    // Create new Supabase auth user
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: loginEmail,
      password: passwordToUse,
      email_confirm: true,
      user_metadata: { role: "customer", customer_code: customer.customer_code },
    });

    if (authError || !authUser?.user) {
      throw new Error(authError?.message ?? "Failed to create portal user");
    }

    // Insert or update profile
    await admin.from("profiles").upsert({
      id: authUser.user.id,
      role: "customer",
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email || null,
      created_by: actingUser.id,
    });

    // Link customer to auth user
    const { error: linkErr } = await supabase
      .from("customers")
      .update({ auth_user_id: authUser.user.id })
      .eq("id", customer.id);

    if (linkErr) {
      throw new Error(linkErr.message);
    }
  }

  await admin.from("audit_logs").insert({
    actor_id: actingUser.id,
    action: "customer.auth_provisioned",
    entity_type: "customer",
    entity_id: customer.id,
    new_value: { username, updated_at: new Date().toISOString() },
  });

  revalidatePath(`/dashboard/customers/${params.customerId}`);
  revalidatePath("/dashboard/customers");

  return {
    username,
    customerCode: customer.customer_code,
    tempPassword: passwordToUse,
    loginEmail,
  };
}

export async function deleteCustomer(params: { customerId: string }) {
  const supabase = await createClient();
  const {
    data: { user: actingUser },
  } = await supabase.auth.getUser();
  if (!actingUser) throw new Error("Not authenticated");

  const { data: actingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", actingUser.id)
    .single();
  if (!actingProfile || !["super_admin", "admin"].includes(actingProfile.role)) {
    throw new Error("Insufficient permissions to delete customer");
  }

  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("*")
    .eq("id", params.customerId)
    .single();

  if (custErr || !customer) {
    throw new Error("Customer not found");
  }

  const admin = createServiceRoleClient();

  // Find all contracts for this customer
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id")
    .eq("customer_id", params.customerId);

  const contractIds = (contracts || []).map((c) => c.id);

  if (contractIds.length > 0) {
    // Delete payments
    await supabase.from("payments").delete().in("contract_id", contractIds);
    // Delete installment schedules
    await supabase.from("installment_schedules").delete().in("contract_id", contractIds);
    // Delete documents & agreements
    await supabase.from("documents").delete().in("contract_id", contractIds);
    await supabase.from("agreements").delete().in("contract_id", contractIds);
    // Delete contracts
    await supabase.from("contracts").delete().in("id", contractIds);
  }

  // Delete any customer documents
  await supabase.from("documents").delete().eq("customer_id", params.customerId);

  // Delete customer record
  const { error: delErr } = await supabase
    .from("customers")
    .delete()
    .eq("id", params.customerId);

  if (delErr) {
    throw new Error(delErr.message);
  }

  // If customer had an auth user, delete it
  if (customer.auth_user_id) {
    try {
      await admin.auth.admin.deleteUser(customer.auth_user_id);
    } catch {
      // Ignore auth user delete error if already removed
    }
  }

  // Audit log
  await admin.from("audit_logs").insert({
    actor_id: actingUser.id,
    action: "customer.delete",
    entity_type: "customer",
    entity_id: params.customerId,
    previous_value: customer,
    new_value: null,
  });

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/contracts");
  revalidatePath("/dashboard");
  return { success: true };
}

