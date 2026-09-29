"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { assertSuperAdmin, writeAudit } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const CreateStaffSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["admin", "super_admin"]),
});

function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Only the Super Admin can create staff accounts. */
export async function createStaffUser(input: z.infer<typeof CreateStaffSchema>) {
  const parsed = CreateStaffSchema.parse(input);
  const actor = await assertSuperAdmin();

  const tempPassword = generatePassword();
  const admin = createServiceRoleClient();

  const { data: authUser, error } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { role: parsed.role },
  });
  if (error || !authUser?.user) throw new Error("Could not create that user account: " + (error?.message || ""));

  await admin.from("profiles").insert({
    id: authUser.user.id,
    role: parsed.role,
    full_name: parsed.fullName,
    email: parsed.email,
    phone: parsed.phone ?? null,
    created_by: actor.id,
    is_active: true,
  });

  await writeAudit({
    actorId: actor.id,
    action: "user.create",
    entityType: "profile",
    entityId: authUser.user.id,
    newValue: { email: parsed.email, role: parsed.role },
  });

  revalidatePath("/dashboard/users");
  return { email: parsed.email, tempPassword };
}

export async function setUserActive(userId: string, isActive: boolean) {
  const actor = await assertSuperAdmin();
  if (userId === actor.id) throw new Error("You cannot deactivate your own account.");

  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);

  await writeAudit({
    actorId: actor.id,
    action: isActive ? "user.activate" : "user.deactivate",
    entityType: "profile",
    entityId: userId,
  });
  revalidatePath("/dashboard/users");
}

export async function changeUserRole(userId: string, role: "admin" | "super_admin") {
  const actor = await assertSuperAdmin();
  if (userId === actor.id) throw new Error("You cannot change your own role.");

  const supabase = await createClient();
  const { data: before } = await supabase.from("profiles").select("role").eq("id", userId).single();
  await supabase.from("profiles").update({ role }).eq("id", userId);

  await writeAudit({
    actorId: actor.id,
    action: "user.role_change",
    entityType: "profile",
    entityId: userId,
    previousValue: before,
    newValue: { role },
  });
  revalidatePath("/dashboard/users");
}

export async function adminResetUserPassword(userId: string, newPassword?: string) {
  const actor = await assertSuperAdmin();
  const pwd = newPassword?.trim() || generatePassword();
  if (pwd.length < 6) throw new Error("Password must be at least 6 characters.");

  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: pwd });
  if (error) throw new Error("Could not update password on server: " + error.message);

  await writeAudit({
    actorId: actor.id,
    action: "user.password_reset",
    entityType: "profile",
    entityId: userId,
    newValue: { message: "Super Admin directly updated user password." },
  });

  return { newPassword: pwd };
}

export async function assignUserSections(userId: string, assignedSections: string[]) {
  const actor = await assertSuperAdmin();
  const admin = createServiceRoleClient();

  const { data: userData, error: fetchErr } = await admin.auth.admin.getUserById(userId);
  if (fetchErr || !userData.user) throw new Error("Could not find user.");

  const currentMeta = userData.user.user_metadata || {};
  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...currentMeta,
      assigned_sections: assignedSections,
    },
  });

  if (updateErr) throw new Error("Could not update assigned sections: " + updateErr.message);

  await writeAudit({
    actorId: actor.id,
    action: "user.sections_assigned",
    entityType: "profile",
    entityId: userId,
    newValue: { assigned_sections: assignedSections },
  });

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard");
  return { success: true };
}
