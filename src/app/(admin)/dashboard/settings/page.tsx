import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "Settings — InstallPro" };

export default async function SettingsPage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("business_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: 672,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
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
          Business Settings
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "#4B5563",
            marginTop: 4,
            marginBottom: 0,
          }}
        >
          Company identification and defaults printed on official legal agreements and invoices.
        </p>
      </div>

      <SettingsClient settings={settings} />
    </div>
  );
}
