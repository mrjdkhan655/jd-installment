"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ThemeSwitcher } from "./ThemeSwitcher";

/* ── Micro icon set — all SVG line icons, no emoji ────────── */
const IC = {
  Home: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  Users: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  File: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  Card: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>,
  Check: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  Chart: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  Calendar: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  Docs: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>,
  Gear: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  User: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
  Log: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  SignOut: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>,
  Package: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>,
  Menu: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7"/></svg>,
};

export type SectionKey =
  | "ledger"
  | "overview"
  | "customers"
  | "contracts"
  | "payments"
  | "documents"
  | "administration";

interface NavLinkItem {
  href: string;
  label: string;
  icon: () => React.JSX.Element;
  exact: boolean;
  sectionKey: SectionKey;
  badge?: boolean;
  superAdminOnly?: boolean;
}

const rawSections: { label: string; links: NavLinkItem[] }[] = [
  {
    label: "Overview",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: IC.Home, exact: true, sectionKey: "overview" },
      { href: "/dashboard/ledger", label: "Executive Ledgers", icon: IC.Card, exact: false, sectionKey: "ledger" },
    ],
  },
  {
    label: "Management",
    links: [
      { href: "/dashboard/customers", label: "Customers", icon: IC.Users, exact: false, sectionKey: "customers" },
      { href: "/dashboard/contracts",  label: "Contracts",  icon: IC.File,  exact: false, sectionKey: "contracts" },
      { href: "/dashboard/products/cars", label: "Cars",   icon: IC.Package, exact: false, sectionKey: "contracts" },
      { href: "/dashboard/products/gold", label: "Gold",   icon: IC.Package, exact: false, sectionKey: "contracts" },
    ],
  },
  {
    label: "Finance",
    links: [
      { href: "/dashboard/payments",              label: "Payments",      icon: IC.Card,     exact: false, sectionKey: "payments" },
      { href: "/dashboard/installments",          label: "Installments",  icon: IC.Calendar, exact: false, sectionKey: "payments" },
      { href: "/dashboard/payments/verification", label: "Verification",  icon: IC.Check,    exact: false, badge: true, sectionKey: "payments" },
      { href: "/dashboard/reports",               label: "Reports",       icon: IC.Chart,    exact: false, sectionKey: "payments" },
    ],
  },
  {
    label: "Documents",
    links: [
      { href: "/dashboard/agreements", label: "Agreements", icon: IC.File, exact: false, sectionKey: "documents" },
      { href: "/dashboard/documents",  label: "Documents",  icon: IC.Docs, exact: false, sectionKey: "documents" },
    ],
  },
  {
    label: "Administration",
    links: [
      { href: "/dashboard/users",    label: "Users",     icon: IC.User, exact: false, sectionKey: "administration", superAdminOnly: true },
      { href: "/dashboard/settings", label: "Settings",  icon: IC.Gear, exact: false, sectionKey: "administration", superAdminOnly: true },
      { href: "/dashboard/audit",    label: "Audit Log", icon: IC.Log,  exact: false, sectionKey: "administration", superAdminOnly: true },
    ],
  },
];

interface SidebarProps {
  profile: { full_name: string; role: string };
  pendingCount?: number;
  assignedSections?: string[];
}

export function Sidebar({ profile, pendingCount = 0, assignedSections = ["all"] }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const isSuperAdmin = profile.role === "super_admin";
  const hasAll = assignedSections.includes("all");

  const visibleSections = rawSections
    .map((sec) => {
      const filteredLinks = sec.links.filter((link) => {
        if (link.superAdminOnly && !isSuperAdmin) return false;
        if (hasAll) return true;
        return assignedSections.includes(link.sectionKey);
      });
      return { ...sec, links: filteredLinks };
    })
    .filter((sec) => sec.links.length > 0);

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside
      style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 240,
        background: "#FFFFFF", borderRight: "1px solid #E5E7EB",
        display: "flex", flexDirection: "column", zIndex: 40, overflowY: "auto",
      }}
    >
      {/* Brand */}
      <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid #E5E7EB", flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo.png"
          alt="Muhammad Wahab"
          style={{
            height: 38,
            maxWidth: "100%",
            objectFit: "contain",
            marginBottom: 6,
            display: "block",
          }}
        />
        <p style={{ fontSize: 13, fontWeight: 700, color: "#111418", lineHeight: 1.2, margin: 0 }}>Muhammad Wahab</p>
        <p style={{ fontSize: 10, color: "#8A9099", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.03em" }}>Installment Finance</p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 8px", overflowY: "auto" }}>
        {visibleSections.map((section) => (
          <div key={section.label}>
            <p className="nav-section-label">{section.label}</p>
            {section.links.map((link) => {
              const active = isActive(link.href, link.exact);
              const showBadge = "badge" in link && link.badge && pendingCount > 0;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link${active ? " active" : ""}`}
                >
                  <span className="nav-icon"><link.icon /></span>
                  <span style={{ flex: 1 }}>{link.label}</span>
                  {showBadge && <span className="nav-badge">{pendingCount}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User & Theme */}
      <div style={{ padding: "12px 8px 16px", borderTop: "1px solid var(--border-default, #E5E7EB)", flexShrink: 0 }}>
        <div style={{ padding: "4px 10px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink, #111418)" }}>{profile.full_name}</p>
            <p style={{ fontSize: 11, color: "var(--color-ink-50, #8A9099)", textTransform: "capitalize", marginTop: 1 }}>
              {profile.role.replace(/_/g, " ")}
            </p>
          </div>
          <ThemeSwitcher compact />
        </div>
        <button onClick={signOut}
          className="nav-link"
          style={{ width: "100%", border: "none", cursor: "pointer", background: "none" }}>
          <span className="nav-icon"><IC.SignOut /></span>
          Sign out
        </button>
      </div>
    </aside>
  );
}

/* ── Bottom tab bar (mobile ≤1023px) ──────────────────────── */
const rawTabs = [
  { href: "/dashboard",                       label: "Home",      icon: IC.Home,  exact: true,  badge: false, sectionKey: "overview" as SectionKey },
  { href: "/dashboard/ledger",                label: "Ledgers",   icon: IC.Card,  exact: false, badge: false, sectionKey: "ledger" as SectionKey },
  { href: "/dashboard/customers",             label: "Customers", icon: IC.Users, exact: false, badge: false, sectionKey: "customers" as SectionKey },
  { href: "/dashboard/payments/verification", label: "Verify",    icon: IC.Check, exact: false, badge: true,  sectionKey: "payments" as SectionKey },
  { href: "/dashboard/reports",               label: "Reports",   icon: IC.Chart, exact: false, badge: false, sectionKey: "payments" as SectionKey },
];

const moreLinks: NavLinkItem[] = [
  { href: "/dashboard/contracts",     label: "Contracts",    icon: IC.File,     exact: false, sectionKey: "contracts"      as SectionKey, superAdminOnly: false },
  { href: "/dashboard/products/cars", label: "Cars",         icon: IC.Package,  exact: false, sectionKey: "contracts"      as SectionKey, superAdminOnly: false },
  { href: "/dashboard/products/gold", label: "Gold",         icon: IC.Package,  exact: false, sectionKey: "contracts"      as SectionKey, superAdminOnly: false },
  { href: "/dashboard/payments",      label: "Payments",     icon: IC.Card,     exact: false, sectionKey: "payments"       as SectionKey, superAdminOnly: false },
  { href: "/dashboard/installments",  label: "Installments", icon: IC.Calendar, exact: false, sectionKey: "payments"       as SectionKey, superAdminOnly: false },
  { href: "/dashboard/agreements",    label: "Agreements",   icon: IC.File,     exact: false, sectionKey: "documents"      as SectionKey, superAdminOnly: false },
  { href: "/dashboard/documents",     label: "Documents",    icon: IC.Docs,     exact: false, sectionKey: "documents"      as SectionKey, superAdminOnly: false },
  { href: "/dashboard/users",         label: "Users",        icon: IC.User,     exact: false, sectionKey: "administration" as SectionKey, superAdminOnly: true  },
  { href: "/dashboard/settings",      label: "Settings",     icon: IC.Gear,     exact: false, sectionKey: "administration" as SectionKey, superAdminOnly: true  },
  { href: "/dashboard/audit",         label: "Audit Log",    icon: IC.Log,      exact: false, sectionKey: "administration" as SectionKey, superAdminOnly: true  },
];

export function BottomTabBar({
  pendingCount = 0,
  assignedSections = ["all"],
  isSuperAdmin = false,
}: {
  pendingCount?: number;
  assignedSections?: string[];
  isSuperAdmin?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const hasAll = assignedSections.includes("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  const visibleTabs = rawTabs.filter((t) => {
    if (hasAll) return true;
    return assignedSections.includes(t.sectionKey);
  });

  const visibleMoreLinks = moreLinks.filter((l) => {
    if (l.superAdminOnly && !isSuperAdmin) return false;
    if (hasAll) return true;
    return assignedSections.includes(l.sectionKey);
  });

  /* More tab active only when no primary tab is already active */
  const anyPrimaryActive = visibleTabs.some((t) =>
    t.exact ? pathname === t.href : pathname.startsWith(t.href)
  );
  const isMoreActive =
    !anyPrimaryActive &&
    visibleMoreLinks.some((l) =>
      l.exact ? pathname === l.href : pathname.startsWith(l.href)
    );

  async function signOut() {
    setSheetOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (visibleTabs.length === 0) return null;

  return (
    <>
      {/* Backdrop — closes sheet on outside tap */}
      {sheetOpen && (
        <div
          className="mobile-sheet-backdrop lg:hidden"
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-up More sheet */}
      {visibleMoreLinks.length > 0 && (
        <div
          className={`mobile-sheet lg:hidden${sheetOpen ? " sheet-open" : ""}`}
          role="dialog"
          aria-label="More navigation options"
          aria-modal="true"
          aria-hidden={!sheetOpen}
        >
          <div className="sheet-handle" aria-hidden="true" />
          {visibleMoreLinks.map((l) => {
            const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`sheet-nav-item${active ? " active" : ""}`}
                onClick={() => setSheetOpen(false)}
                aria-current={active ? "page" : undefined}
              >
                <l.icon />
                {l.label}
              </Link>
            );
          })}
          <button
            onClick={signOut}
            className="sheet-nav-item sheet-signout"
            aria-label="Sign out"
          >
            <IC.SignOut />
            Sign Out
          </button>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="bottom-tab-bar lg:hidden">
        {visibleTabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`tab-btn${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {t.badge && pendingCount > 0 && (
                <span className="tab-dot">{pendingCount}</span>
              )}
              <t.icon />
              <span>{t.label}</span>
            </Link>
          );
        })}
        {visibleMoreLinks.length > 0 && (
          <button
            className={`tab-btn${isMoreActive ? " active" : ""}`}
            onClick={() => setSheetOpen((o) => !o)}
            aria-label="More navigation options"
            aria-expanded={sheetOpen}
            aria-haspopup="dialog"
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            <IC.Menu />
            <span>More</span>
          </button>
        )}
      </nav>
    </>
  );
}
