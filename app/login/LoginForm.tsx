"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm({
  demo,
}: {
  demo: { email: string; password: string } | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(demo?.email ?? "");
  const [password, setPassword] = useState(demo?.password ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Login failed");
        return;
      }
      router.push(params.get("next") || "/dashboard");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <label className="block text-sm font-medium text-phyt-ink/80">
          Email
        </label>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-phyt-ink/15 bg-white px-4 py-2.5 outline-none focus:border-phyt-blue focus:ring-2 focus:ring-phyt-blue/40"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-phyt-ink/80">
          Password
        </label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-phyt-ink/15 bg-white px-4 py-2.5 outline-none focus:border-phyt-blue focus:ring-2 focus:ring-phyt-blue/40"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-phyt-pink-soft px-4 py-2.5 text-sm text-phyt-ink">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-phyt-yellow px-4 py-3 font-display font-bold text-phyt-ink transition hover:brightness-95 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      {demo && (
        <p className="rounded-xl bg-phyt-blue-soft px-4 py-2.5 text-center text-xs text-phyt-ink/80">
          Demo mode — prefilled credentials. Set <code>ADMIN_PASSWORD</code> /{" "}
          <code>CLIENT_PASSWORD</code> to lock it down.
        </p>
      )}
    </form>
  );
}
