import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        page:    "#FAF9F6",
        surface: "#FFFFFF",
        border:  "#EAE7E0",
        "border-strong": "#D6D2C7",
        ink:     "#0B1B3D",
        "ink-70":"#334155",
        "ink-50":"#64748B",
        brand: {
          navy: "#0B1B3D",
          gold: "#B89047",
          "gold-warm": "#C5A880",
          emerald: "#0F4C3A",
        },
        accent: {
          DEFAULT:"#0F4C3A",
          hover:  "#0A372A",
          tint:   "#EBF5F1",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        serif: ["var(--font-serif)", "Playfair Display", "Georgia", "serif"],
        mono: ['"SF Mono"', '"Roboto Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card:  "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
        modal: "0 4px 6px rgba(16,24,40,0.05), 0 10px 15px rgba(16,24,40,0.08)",
      },
      borderRadius: {
        DEFAULT: "8px",
        sm:  "6px",
        md:  "8px",
        lg:  "10px",
        xl:  "10px",
      },
      maxWidth: {
        content: "1152px",
        form:    "720px",
        portal:  "640px",
        modal:   "480px",
      },
    },
  },
  plugins: [],
};

export default config;
