"use client";

import { useState } from "react";

interface Kpi {
  id: number;
  metric: string;
  target: number;
  direction: "up" | "down";
}

const prettyMetric = (m: string) =>
  m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function KpiManager({ initialKpis }: { initialKpis: Kpi[] }) {
  const [kpis, setKpis] = useState<Kpi[]>(initialKpis);
  const [metric, setMetric] = useState("");
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings/kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric, target: Number(target), direction }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Could not save");
      setKpis(data.kpis);
      setMetric("");
      setTarget("");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    const res = await fetch(`/api/settings/kpis/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) setKpis(data.kpis);
  }

  return (
    <div className="rounded-2xl border border-phyt-ink/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-phyt-ink/10 text-left text-xs uppercase tracking-wide text-phyt-ink/50">
            <th className="px-4 py-3">Metric</th>
            <th className="px-4 py-3">Target</th>
            <th className="px-4 py-3">Better when</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {kpis.map((k) => (
            <tr key={k.id} className="border-b border-phyt-ink/5">
              <td className="px-4 py-3 font-medium">{prettyMetric(k.metric)}</td>
              <td className="px-4 py-3">{k.target}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs ${
                    k.direction === "up" ? "bg-phyt-green-soft" : "bg-phyt-pink-soft"
                  }`}
                >
                  {k.direction === "up" ? "Higher ↑" : "Lower ↓"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => remove(k.id)}
                  className="text-phyt-ink/50 hover:text-phyt-ink"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={save} className="flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="block text-xs text-phyt-ink/60">Metric</label>
          <input
            required
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            placeholder="e.g. cpa"
            className="mt-1 w-40 rounded-lg border border-phyt-ink/15 px-3 py-2 outline-none focus:border-phyt-blue"
          />
        </div>
        <div>
          <label className="block text-xs text-phyt-ink/60">Target</label>
          <input
            required
            type="number"
            step="any"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-1 w-28 rounded-lg border border-phyt-ink/15 px-3 py-2 outline-none focus:border-phyt-blue"
          />
        </div>
        <div>
          <label className="block text-xs text-phyt-ink/60">Better when</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "up" | "down")}
            className="mt-1 rounded-lg border border-phyt-ink/15 px-3 py-2 outline-none focus:border-phyt-blue"
          >
            <option value="up">Higher ↑</option>
            <option value="down">Lower ↓</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-phyt-yellow px-4 py-2 font-display font-bold disabled:opacity-60"
        >
          {busy ? "Saving…" : "Add / update"}
        </button>
        {error && <span className="text-sm text-phyt-ink/70">{error}</span>}
      </form>
    </div>
  );
}
