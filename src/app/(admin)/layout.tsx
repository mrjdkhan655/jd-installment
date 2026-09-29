import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar, BottomTabBar } from "@/components/Sidebar";
import { AdminHeader } from "@/components/AdminHeader";

export const metadata: Metadata = { title: "InstallPro" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["super_admin", "admin"].includes(profile.role)) redirect("/login");

  const { count: pendingCount } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("verification_status", "pending");

  const rawSections = user.user_metadata?.assigned_sections;
  const assignedSections: string[] =
    Array.isArray(rawSections) && rawSections.length > 0
      ? rawSections
      : ["all"];

  const isSuperAdmin = profile.role === "super_admin";

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: "var(--bg-page, #FAF9F6)" }}>
      {/* Sidebar — desktop only (240px fixed left) */}
      <div className="hidden lg:block" style={{ width: 240, flexShrink: 0 }}>
        <Sidebar
          profile={profile}
          pendingCount={pendingCount ?? 0}
          assignedSections={assignedSections}
        />
      </div>

      {/* Main Administrative Area */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top Header (56px Desktop / 52px Sticky Mobile) */}
        <AdminHeader profile={profile} pendingCount={pendingCount ?? 0} />

        {/* Page Content Canvas */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            paddingBottom: "calc(var(--mobile-bottom-nav-height, 60px) + env(safe-area-inset-bottom, 0px) + 8px)", /* Mobile tab bar + iOS home indicator */
          }}
          className="lg:pb-0"
        >
          <div
            className="p-4 lg:p-8"
            style={{
              maxWidth: 1440,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation (Fixed 60px 5-item bar) */}
      <BottomTabBar
        pendingCount={pendingCount ?? 0}
        assignedSections={assignedSections}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
