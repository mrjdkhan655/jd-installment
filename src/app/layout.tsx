import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

export const runtime = "edge";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0B1B3D",
};

export const metadata: Metadata = {
  title: {
    default: "Muhammad Wahab — Installment Management System",
    template: "%s | Muhammad Wahab",
  },
  description: "Secure installment contracts, payment tracking, and portfolio management by Muhammad Wahab.",
  icons: {
    icon: "/brand/logo-square.png",
    shortcut: "/brand/logo-square.png",
    apple: "/brand/logo-square.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mw_pro_theme')||'royal-gold';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-surface text-ink antialiased font-sans">{children}</body>
    </html>
  );
}
