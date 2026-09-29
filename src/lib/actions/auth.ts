"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export interface ChangePasswordResult {
  success: boolean;
  error?: string;
}

/**
 * Directly updates the password of the currently authenticated user
 * (works for Admin, Super Admin, and Customer).
 */
export async function changeUserPassword(newPassword: string): Promise<ChangePasswordResult> {
  try {
    const trimmed = newPassword.trim();
    if (!trimmed || trimmed.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }

    const supabase = await createClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { success: false, error: "Session expired. Please sign in again." };
    }

    // Use service role client to directly update auth password on server
    const serviceRole = createServiceRoleClient();
    const { error: updateErr } = await serviceRole.auth.admin.updateUserById(user.id, {
      password: trimmed,
    });

    if (updateErr) {
      return { success: false, error: updateErr.message || "Failed to update password." };
    }

    // Record audit log
    try {
      await serviceRole.from("audit_logs").insert({
        actor_id: user.id,
        action: "password_updated",
        entity: "profiles",
        entity_id: user.id,
        changes: { message: "User updated their account password directly." },
      });
    } catch {
      // Non-blocking audit log
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
