"use client";

import { useState } from "react";

interface CredField {
  key: string;
  label: string;
  secret: boolean;
  multiline?: boolean;
  placeholder?: string;
}
interface CredGroup {
  provider: string;
  title: string;
  hint: string;
  docUrl: string;
  docLabel: string;
  fields: CredField[];
}
interface CredStatus {
  key: string;
  configured: boolean;
  source: "saved" | "env" | "none";
  preview: string;
}

export default function CredentialsManager({
  groups,
  initialStatus,
}: {
  groups: CredGroup[];
  initialStatus: CredStatus[];
}) {
  const [status, setStatus] = useState<Record<string, CredStatus>>(
    Object.fromEntries(initialStatus.map((s) => [s.key, s])),
  );
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function save(key: string, value: string) {
    setBusy(key);
    try {
      const res = await fetch("/api/settings/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(Object.fromEntries(data.status.map((s: CredStatus) => [s.key, s])));
        setInputs((p) => ({ ...p, [key]: "" }));
      }
    } finally {
      setBusy(null);
    }
  }

  function groupConnected(g: CredGroup) {
    // "Connected" = every required field configured (model is optional).
    return g.fields
      .filter((f) => f.key !== "ANTHROPIC_MODEL" && f.key !== "POSTHOG_HOST")
      .every((f) => status[f.key]?.configured);
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const connected = groupConnected(g);
        return (
          <div key={g.provider} className="rounded-2xl border border-phyt-ink/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg">{g.title}</h3>
                <p className="text-xs text-phyt-ink/55">{g.hint}</p>
                <a
                  href={g.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-phyt-ink underline decoration-phyt-blue decoration-2 underline-offset-2 hover:text-phyt-ink/70"
                >
                  {g.docLabel} ↗
                </a>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  connected ? "bg-phyt-green-soft" : "bg-phyt-ink/5 text-phyt-ink/50"
                }`}
              >
                {connected ? "Connected" : "Not set"}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {g.fields.map((f) => {
                const st = status[f.key];
                return (
                  <div key={f.key} className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[220px]">
                      <label className="flex items-center gap-2 text-xs text-phyt-ink/60">
                        {f.label}
                        {st?.configured && (
                          <span className="rounded-full bg-phyt-ink/5 px-2 py-0.5 text-[10px]">
                            {st.source === "env" ? "from env" : "saved"}: {st.preview}
                          </span>
                        )}
                      </label>
                      {f.multiline ? (
                        <textarea
                          rows={3}
                          value={inputs[f.key] ?? ""}
                          onChange={(e) => setInputs((p) => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={st?.configured ? "•••• saved — paste to replace" : f.placeholder || ""}
                          className="mt-1 w-full rounded-lg border border-phyt-ink/15 px-3 py-2 font-mono text-xs outline-none focus:border-phyt-blue"
                        />
                      ) : (
                        <input
                          type={f.secret ? "password" : "text"}
                          value={inputs[f.key] ?? ""}
                          onChange={(e) => setInputs((p) => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={st?.configured ? "•••• saved — type to replace" : f.placeholder || ""}
                          className="mt-1 w-full rounded-lg border border-phyt-ink/15 px-3 py-2 text-sm outline-none focus:border-phyt-blue"
                        />
                      )}
                    </div>
                    <button
                      onClick={() => save(f.key, inputs[f.key] ?? "")}
                      disabled={busy === f.key || !(inputs[f.key] ?? "").trim()}
                      className="rounded-lg bg-phyt-yellow px-3 py-2 text-sm font-display font-bold disabled:opacity-40"
                    >
                      {busy === f.key ? "…" : "Save"}
                    </button>
                    {st?.source === "saved" && (
                      <button
                        onClick={() => save(f.key, "")}
                        disabled={busy === f.key}
                        className="rounded-lg border border-phyt-ink/15 px-3 py-2 text-sm hover:bg-phyt-ink/5"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-phyt-ink/50">
        Keys are encrypted before storage and never sent back to the browser. A saved
        key overrides the matching environment variable. The dashboard&apos;s “Live
        data” badge confirms a working connection.
      </p>
    </div>
  );
}
