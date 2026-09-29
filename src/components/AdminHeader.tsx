"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface AdminHeaderProps {
  profile: { full_name: string; role: string };
  pendingCount?: number;
}

/* ── Mobile account menu (avatar → dropdown with sign-out) ─── */
function MobileAccountMenu({ profile }: { profile: { full_name: string; role: string } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, [open]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "var(--primary)", color: "#fff",
          fontSize: 13, fontWeight: 700, flexShrink: 0,
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {profile.full_name?.charAt(0).toUpperCase() || "A"}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-modal)",
          minWidth: 180, zIndex: 200, padding: "8px 0",
        }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-default)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
              {profile.full_name}
            </p>
            <p style={{ fontSize: 11, color: "var(--color-ink-50)", margin: "2px 0 0", textTransform: "capitalize" }}>
              {profile.role.replace(/_/g, " ")}
            </p>
          </div>
          <button
            onClick={signOut}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "12px 14px", minHeight: 44,
              background: "none", border: "none",
              fontSize: 13, fontWeight: 500, color: "#B91C1C",
              cursor: "pointer", textAlign: "left",
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminHeader({ profile, pendingCount = 0 }: AdminHeaderProps) {
  const currentDate = new Date().toLocaleDateString("en-AE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      {/* Desktop Header (≥ 1024px) */}
      <header
        className="hidden lg:flex items-center justify-between px-8 border-b z-30"
        style={{
          height: "var(--header-height, 56px)",
          borderColor: "var(--border-default)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        {/* Left: Organization & Scope Indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--primary)" }}
              title="System Online"
            />
            <span className="text-xs font-semibold text-gray-900 tracking-wide">
              UAE Operations
            </span>
          </div>
          <span className="text-gray-300">|</span>
          <span className="text-xs text-gray-500 font-medium">
            Active Financial Ledger
          </span>
        </div>

        {/* Right: Operational Date & Profile Status */}
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500 font-medium tabular-nums">
            {currentDate}
          </div>

          {/* Instant 10-Theme Pro Max Switcher */}
          <ThemeSwitcher />

          {pendingCount > 0 && (
            <Link
              href="/dashboard/payments/verification"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 transition-colors hover:bg-amber-100"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
              <span>{pendingCount} to verify</span>
            </Link>
          )}

          <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ backgroundColor: "var(--primary)" }}
            >
              {profile.full_name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-medium text-gray-900 leading-tight">
                {profile.full_name}
              </span>
              <span className="text-[10px] text-gray-500 capitalize">
                {profile.role?.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Top Header (< 1024px) */}
      <header
        className="lg:hidden sticky top-0 flex items-center justify-between px-4 bg-white border-b z-30"
        style={{
          height: "52px",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.png"
            alt="Muhammad Wahab"
            style={{
              height: 28,
              maxWidth: 120,
              objectFit: "contain",
            }}
          />
          <span className="font-semibold text-xs text-gray-900">Muhammad Wahab</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Instant Theme Switcher */}
          <ThemeSwitcher compact />

          {pendingCount > 0 && (
            <Link
              href="/dashboard/payments/verification"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              <span>{pendingCount}</span>
            </Link>
          )}

          <MobileAccountMenu profile={profile} />
        </div>
      </header>
    </>
  );
}
