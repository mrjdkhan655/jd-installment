"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId || !cleanPass) {
      setError("Invalid username or password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // If customer enters username like cust-00001, automatically append @login.internal
      const email = cleanId.includes("@")
        ? cleanId
        : `${cleanId.toLowerCase()}@login.internal`;

      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password: cleanPass,
      });

      if (authErr || !data.user) {
        throw new Error("Invalid username or password.");
      }

      // Route by role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profile?.role === "customer") {
        router.push("/portal");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch {
      // Per spec: never reveal whether username or password was incorrect
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#F7F8FA",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 384 }}>
        {/* Official Brand Logo & Header */}
        <div style={{ marginBottom: 20, textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.png"
            alt="Muhammad Wahab"
            style={{
              height: 64,
              maxWidth: 240,
              objectFit: "contain",
              margin: "0 auto 12px",
              display: "block",
            }}
          />
          <h1
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: "#111418",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            Muhammad Wahab
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "#8A9099",
              marginTop: 4,
              lineHeight: 1.4,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            Private Installment Finance
          </p>
        </div>

        {/* 384px Surface Card */}
        <div
          className="card"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: "24px 20px",
            boxShadow:
              "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
          }}
        >
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Username or Email field */}
              <div className="field">
                <label
                  htmlFor="identifier"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#8A9099",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Username or email
                </label>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. cust-00012 or admin@business.ae"
                  className="field-input"
                  style={{
                    fontSize: 16, // prevents iOS auto-zoom
                    minHeight: 44,
                  }}
                />
              </div>

              {/* Password field */}
              <div className="field">
                <label
                  htmlFor="password"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#8A9099",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="field-input"
                  style={{
                    fontSize: 16, // prevents iOS auto-zoom
                    minHeight: 44,
                  }}
                />
              </div>

              {/* Single red line error above button */}
              {error && (
                <p
                  role="alert"
                  style={{
                    fontSize: 12,
                    color: "#B91C1C",
                    lineHeight: 1.4,
                    margin: 0,
                  }}
                >
                  {error}
                </p>
              )}

              {/* Primary action button */}
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{
                  width: "100%",
                  minHeight: 44,
                  height: 44,
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  marginTop: 4,
                  backgroundColor: "#0F4C3A",
                  color: "#FFFFFF",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </div>
          </form>
        </div>

        {/* Security / System note */}
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#8A9099",
            marginTop: 24,
            lineHeight: 1.5,
          }}
        >
          Authorised personnel and registered customers only.
        </p>
      </div>
    </div>
  );
}
