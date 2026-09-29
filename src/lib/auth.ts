import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AppRole } from "@/types/domain";

export interface SessionUser {
  id: string;
  role: AppRole;
  fullName: string;
  email: string | null;
  assignedSections: string[];
}

/** Returns the current user's profile, or null if not signed in. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) return null;

  const rawSections = user.user_metadata?.assigned_sections;
  const assignedSections: string[] =
    Array.isArray(rawSections) && rawSections.length > 0
      ? rawSections
      : ["all"];

  return {
    id: profile.id,
    role: profile.role,
    fullName: profile.full_name,
    email: profile.email,
    assignedSections,
  };
}

/** Guard for Server Components: must be admin or super_admin. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" && user.role !== "super_admin") redirect("/portal");
  return user;
}

/** Guard for Server Components: must be super_admin. */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireStaff();
  if (user.role !== "super_admin") redirect("/dashboard");
  return user;
}

/** Guard for Server Actions — throws instead of redirecting. */
export async function assertStaff(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("You are not signed in.");
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new Error("You do not have permission to perform this action.");
  }
  return user;
}

export async function assertSuperAdmin(): Promise<SessionUser> {
  const user = await assertStaff();
  if (user.role !== "super_admin") {
    throw new Error("Only the Super Admin can perform this action.");
  }
  return user;
}

/** Writes an audit trail entry. Never throws — auditing must not break a workflow. */
export async function writeAudit(entry: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  try {
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      previous_value: entry.previousValue ?? null,
      new_value: entry.newValue ?? null,
    });
  } catch (e) {
    console.error("audit write failed", e);
  }
}
