import { requireSuperAdmin } from "@/lib/auth";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import UsersClient from "./UsersClient";

export const metadata = { title: "Users — InstallPro" };

export default async function UsersPage() {
  const me = await requireSuperAdmin();
  const supabase = await createClient();
  const adminClient = createServiceRoleClient();

  const [{ data: users }, authUsersResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, full_name, email, phone, is_active, created_at")
      .in("role", ["admin", "super_admin"])
      .order("created_at", { ascending: false }),
    adminClient.auth.admin.listUsers().catch(() => ({ data: { users: [] } })),
  ]);

  const authUsersData = authUsersResult?.data;
  const authMetaMap = new Map(
    authUsersData?.users?.map((u: any) => [u.id, u.user_metadata]) || []
  );

  const enrichedUsers = (users ?? []).map((u) => {
    const rawSections = authMetaMap.get(u.id)?.assigned_sections;
    const assignedSections =
      Array.isArray(rawSections) && rawSections.length > 0
        ? (rawSections as string[])
        : ["all"];
    return {
      ...u,
      assigned_sections: assignedSections,
    };
  });

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: 768,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Title */}
      <div>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "#111418",
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          Staff & User Management
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "#4B5563",
            marginTop: 4,
            marginBottom: 0,
          }}
        >
          Manage Admin and Super Admin team accounts and access credentials.
        </p>
      </div>

      <UsersClient initialUsers={enrichedUsers} currentUserId={me.id} />
    </div>
  );
}
