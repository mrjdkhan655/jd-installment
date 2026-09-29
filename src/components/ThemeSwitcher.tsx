"use client";

import { useEffect, useState, useRef } from "react";

export interface ThemeOption {
  id: string;
  name: string;
  tagline: string;
  primary: string;
  accent: string;
  surface: string;
  isDark?: boolean;
}

export const PRO_MAX_THEMES: ThemeOption[] = [
  {
    id: "royal-gold",
    name: "Royal Dubai Gold & Navy",
    tagline: "Signature institutional luxury & warm alabaster",
    primary: "#0F4C3A",
    accent: "#B89047",
    surface: "#FAF9F6",
  },
  {
    id: "emerald-wealth",
    name: "Emerald Private Wealth",
    tagline: "High-net-worth sovereign green & warm amber",
    primary: "#059669",
    accent: "#D97706",
    surface: "#F2FAF5",
  },
  {
    id: "midnight-obsidian",
    name: "Midnight Obsidian (Dark)",
    tagline: "Ultra-modern deep obsidian & electric cyan",
    primary: "#38BDF8",
    accent: "#F59E0B",
    surface: "#0B0F19",
    isDark: true,
  },
  {
    id: "champagne-noir",
    name: "Onyx & Champagne Noir (Dark)",
    tagline: "Velvet black with radiant metallic champagne",
    primary: "#D4AF37",
    accent: "#E5C158",
    surface: "#08080A",
    isDark: true,
  },
  {
    id: "cyber-forest",
    name: "Cyber Forest FinTech (Dark)",
    tagline: "Futuristic digital matrix & vivid jade neon",
    primary: "#10B981",
    accent: "#FBBF24",
    surface: "#041712",
    isDark: true,
  },
  {
    id: "monaco-platinum",
    name: "Monaco Platinum & Silver",
    tagline: "Monochrome elegance & cool silver prestige",
    primary: "#1E293B",
    accent: "#64748B",
    surface: "#F8FAFC",
  },
  {
    id: "swiss-alpine",
    name: "Swiss Alps Banking",
    tagline: "Zurich institutional sapphire & pure glacier white",
    primary: "#1D4ED8",
    accent: "#0284C7",
    surface: "#F0F7FF",
  },
  {
    id: "nordic-slate",
    name: "Nordic Slate & Frost",
    tagline: "Scandinavian minimalism & arctic deep blue",
    primary: "#0284C7",
    accent: "#475569",
    surface: "#F1F5F9",
  },
  {
    id: "imperial-burgundy",
    name: "Imperial Burgundy & Rose",
    tagline: "Aristocratic deep wine & polished rose gold",
    primary: "#881337",
    accent: "#FB7185",
    surface: "#FFF5F5",
  },
  {
    id: "clean-alabaster",
    name: "Clean Alabaster & Royal",
    tagline: "Fresh contemporary executive lavender & cobalt",
    primary: "#2563EB",
    accent: "#F59E0B",
    surface: "#FAF5FF",
  },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [currentTheme, setCurrentTheme] = useState("royal-gold");
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mw_pro_theme") || "royal-gold";
      setCurrentTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } catch {
      // ignore in SSR / restricted iframe
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function applyTheme(themeId: string) {
    setCurrentTheme(themeId);
    try {
      localStorage.setItem("mw_pro_theme", themeId);
      document.documentElement.setAttribute("data-theme", themeId);
    } catch {
      // ignore
    }
    setIsOpen(false);
  }

  const activeThemeObj = PRO_MAX_THEMES.find((t) => t.id === currentTheme) || PRO_MAX_THEMES[0];

  return (
    <div style={{ position: "relative" }} ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: compact ? "4px 8px" : "6px 12px",
          borderRadius: 8,
          border: "1px solid var(--border-default, #E5E7EB)",
          backgroundColor: "var(--bg-surface, #FFFFFF)",
          color: "var(--color-ink, #0B1B3D)",
          fontSize: compact ? 11 : 12,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s ease",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
        title="Change UI/UX Pro Max Theme (Instant)"
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: activeThemeObj.primary,
            border: `2px solid ${activeThemeObj.accent}`,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span>{compact ? "Theme" : activeThemeObj.name.split(" ")[0]}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Menu: 10 Themes */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: 320,
            maxHeight: 460,
            overflowY: "auto",
            backgroundColor: "var(--bg-surface, #FFFFFF)",
            border: "1px solid var(--border-default, #E5E7EB)",
            borderRadius: 12,
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.15)",
            zIndex: 100,
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ padding: "8px 10px 6px", borderBottom: "1px solid var(--border-default, #E5E7EB)", marginBottom: 4 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--color-ink, #0B1B3D)", margin: 0 }}>
              UI/UX Pro Max Themes (10 Presets)
            </p>
            <p style={{ fontSize: 10, color: "var(--color-ink-50, #6B7280)", margin: "2px 0 0" }}>
              Instant zero-latency live visual transformation
            </p>
          </div>

          {PRO_MAX_THEMES.map((theme) => {
            const isSelected = theme.id === currentTheme;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => applyTheme(theme.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: isSelected ? "1.5px solid var(--primary, #0F4C3A)" : "1px solid transparent",
                  backgroundColor: isSelected ? "var(--primary-tint, #EBF5F1)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background-color 0.1s ease",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  {/* Swatch circles */}
                  <div style={{ display: "flex", alignItems: "center", position: "relative", width: 28, height: 18, flexShrink: 0 }}>
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        backgroundColor: theme.primary,
                        border: "1.5px solid #FFFFFF",
                        position: "absolute",
                        left: 0,
                        zIndex: 2,
                      }}
                    />
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        backgroundColor: theme.accent,
                        border: "1.5px solid #FFFFFF",
                        position: "absolute",
                        left: 10,
                        zIndex: 1,
                      }}
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? 700 : 500,
                          color: "var(--color-ink, #0B1B3D)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {theme.name}
                      </span>
                      {theme.isDark && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "1px 4px",
                            borderRadius: 4,
                            backgroundColor: "#1F2937",
                            color: "#F9FAFB",
                          }}
                        >
                          DARK
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--color-ink-50, #6B7280)",
                        display: "block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {theme.tagline}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <span style={{ fontSize: 13, color: "var(--primary, #0F4C3A)", fontWeight: 700, marginLeft: 8 }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
