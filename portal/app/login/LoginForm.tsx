"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getRoleDestination(accessToken: string, userMeta: Record<string, unknown>): string {
  const payload = decodeJwtPayload(accessToken);
  const jwtRole = payload?.app_role as string | undefined;
  const metaRole = userMeta?.app_role as string | undefined;
  const role = (jwtRole && jwtRole !== "parent") ? jwtRole : (metaRole ?? "parent");

  if (role === "owner") return "/owner";
  if (role === "admin") return "/admin";
  if (role === "super_admin") return "/hq";
  if (role === "coach") return "/coach/inbox";
  return null as unknown as string;
}

export function LoginForm({ initialError }: { initialError?: string }) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    if (!email || !password) {
      setError("Please enter both email and password.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.session) {
      setError("Email or password is incorrect.");
      setLoading(false);
      return;
    }

    const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    const destination = getRoleDestination(data.session.access_token, meta);

    if (!destination) {
      await supabase.auth.signOut();
      setError("This portal is for coaches and admins. Parents please use the mobile app.");
      setLoading(false);
      return;
    }

    // Full page navigate so the browser sends the newly-set cookies with the
    // next request — avoids the Next.js server-action cookie timing issue.
    window.location.href = destination;
  }

  const isParentError = error?.includes("Parents please");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm text-warning"
        >
          {error}
        </div>
      ) : null}

      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        label="Email"
        disabled={loading}
      />
      <PasswordInput
        id="password"
        name="password"
        autoComplete="current-password"
        required
        label="Password"
        disabled={loading}
      />
      {!isParentError && (
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      )}
    </form>
  );
}
