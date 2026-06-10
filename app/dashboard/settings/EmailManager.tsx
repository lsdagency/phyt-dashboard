"use client";

import { useState } from "react";

export default function EmailManager({
  recipients,
}: {
  recipients: { email: string; name: string }[];
}) {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function sendTest() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(to ? { to } : {}),
      });
      const d = await res.json();
      setResult(
        res.ok
          ? { ok: true, msg: `Sent to ${d.recipients.join(", ")} · ${d.generatedBy} optimisation.` }
          : { ok: false, msg: d.error || "Send failed." },
      );
    } catch {
      setResult({ ok: false, msg: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-phyt-ink/10 p-5">
      <p className="text-sm text-phyt-ink/70">
        Sends automatically every morning (07:00 UTC) to client users with{" "}
        <strong>Daily email</strong> enabled, with the latest performance and
        Claude&apos;s optimisations.
      </p>

      <div className="mt-3">
        <div className="text-xs uppercase tracking-wide text-phyt-ink/55">
          Current recipients ({recipients.length})
        </div>
        {recipients.length ? (
          <ul className="mt-1 text-sm text-phyt-ink/80">
            {recipients.map((r) => (
              <li key={r.email}>
                {r.name} · {r.email}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-phyt-ink/50">
            None yet — toggle “Daily email” on a client in the users table above.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-phyt-ink/60">
            Send a test to (optional — defaults to you)
          </label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-64 rounded-lg border border-phyt-ink/15 px-3 py-2 text-sm outline-none focus:border-phyt-blue"
          />
        </div>
        <button
          onClick={sendTest}
          disabled={busy}
          className="rounded-lg bg-phyt-yellow px-4 py-2 text-sm font-display font-bold disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send test email"}
        </button>
      </div>

      {result && (
        <p
          className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${
            result.ok ? "bg-phyt-green-soft" : "bg-phyt-pink-soft"
          }`}
        >
          {result.msg}
        </p>
      )}
    </div>
  );
}
