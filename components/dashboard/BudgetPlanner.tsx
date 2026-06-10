"use client";

import { useState } from "react";
import type { AsaCampaign } from "@/lib/integrations/types";
import { money, pct } from "@/lib/format";

const round5 = (n: number) => Math.round(n / 5) * 5;

/**
 * Daily budget planner. Shows each campaign's current daily budget, run rate
 * (actual average daily spend over the period), budget utilisation, and a
 * proposed new daily budget. Two modes:
 *  - Scale mode (default): scales each budget by its LTV:CAC + utilisation.
 *  - Allocate mode: split a total daily budget across enabled campaigns,
 *    weighted by profitable conversions (subs × LTV:CAC).
 */
export default function BudgetPlanner({
  campaigns,
  days,
  currency,
}: {
  campaigns: AsaCampaign[];
  days: number;
  currency: string;
}) {
  const d = Math.max(days, 1);
  const c = currency;

  const sorted = [...campaigns].sort((a, b) => b.installs - a.installs || b.spend - a.spend);
  const [budgets, setBudgets] = useState<Record<string, number>>(
    Object.fromEntries(sorted.map((x) => [x.id, x.dailyBudget])),
  );
  const [total, setTotal] = useState("");

  const rows = sorted.map((x) => {
    const budget = budgets[x.id] ?? x.dailyBudget;
    const runRate = x.spend / d;
    const used = budget > 0 ? runRate / budget : 0;
    return { x, budget, runRate, used };
  });

  const targetTotal = Number(total);
  const allocateMode = total.trim() !== "" && targetTotal > 0;

  const proposed: Record<string, number> = {};
  if (allocateMode) {
    const enabled = rows.filter((r) => r.x.status === "ENABLED");
    const weight = (r: (typeof rows)[number]) =>
      Math.max(r.x.subscriptions * Math.max(r.x.ltvCac, 0.2), r.x.installs * 0.001, 0.001);
    const sumW = enabled.reduce((a, r) => a + weight(r), 0) || 1;
    for (const r of rows) {
      proposed[r.x.id] =
        r.x.status === "ENABLED" ? round5(targetTotal * (weight(r) / sumW)) : 0;
    }
  } else {
    for (const r of rows) {
      if (r.x.status !== "ENABLED") {
        proposed[r.x.id] = r.budget;
        continue;
      }
      let factor = 1;
      if (r.x.ltvCac >= 1.3) factor = r.used > 0.85 ? 1.4 : 1.2;
      else if (r.x.ltvCac > 0 && r.x.ltvCac < 1) factor = 0.7;
      else if (r.x.ltvCac >= 1.1 && r.used > 0.85) factor = 1.15;
      proposed[r.x.id] = Math.max(10, round5(r.budget * factor));
    }
  }

  const totalBudget = rows.reduce((a, r) => a + r.budget, 0);
  const totalRunRate = rows.reduce((a, r) => a + r.runRate, 0);
  const totalProposed = rows.reduce((a, r) => a + proposed[r.x.id], 0);
  const scaleUp = totalBudget > 0 ? (totalProposed / totalBudget - 1) * 100 : 0;

  return (
    <div className="rounded-2xl border border-phyt-ink/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl">Budget planner</h2>
          <p className="text-sm text-phyt-ink/55">
            Run rate is average daily spend over the period. Edit budgets to model,
            or enter a total to split across campaigns by performance.
          </p>
        </div>
        <div>
          <label className="block text-xs text-phyt-ink/60">
            Total daily budget to split (optional)
          </label>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-phyt-ink/50">£</span>
            <input
              type="number"
              min="0"
              step="5"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder={String(Math.round(totalBudget))}
              className="w-32 rounded-lg border border-phyt-ink/15 px-3 py-2 text-sm outline-none focus:border-phyt-blue"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-phyt-ink/10">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-phyt-ink/10 bg-phyt-ink/[0.02] text-left text-[11px] uppercase tracking-wide text-phyt-ink/55">
              <th className="px-3 py-3">Campaign</th>
              <Th>LTV:CAC</Th>
              <Th>Daily budget</Th>
              <Th>Run rate / day</Th>
              <Th>Used</Th>
              <Th>Proposed / day</Th>
              <Th>Δ</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const prop = proposed[r.x.id];
              const delta = prop - r.budget;
              return (
                <tr key={r.x.id} className="border-b border-phyt-ink/5">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{r.x.name}</div>
                    {r.x.status !== "ENABLED" && (
                      <span className="rounded-full bg-phyt-pink-soft px-2 py-0.5 text-[10px] uppercase">
                        {r.x.status.toLowerCase()}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.x.ltvCac >= 1 ? "bg-phyt-green-soft" : "bg-phyt-pink-soft"
                      }`}
                    >
                      {r.x.ltvCac.toFixed(2)}:1
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <span className="text-phyt-ink/50">£</span>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={r.budget}
                        onChange={(e) =>
                          setBudgets((p) => ({ ...p, [r.x.id]: Number(e.target.value) }))
                        }
                        className="w-20 rounded-lg border border-phyt-ink/15 px-2 py-1 text-right text-sm outline-none focus:border-phyt-blue"
                      />
                    </div>
                  </td>
                  <Td>{money(r.runRate, c)}</Td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span
                      className={
                        r.used >= 0.9
                          ? "text-phyt-ink"
                          : r.used >= 0.6
                            ? "text-phyt-ink/70"
                            : "text-phyt-ink/40"
                      }
                    >
                      {pct(r.used * 100, 0)}
                    </span>
                  </td>
                  <Td>{money(prop, c)}</Td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        delta > 0
                          ? "bg-phyt-green-soft"
                          : delta < 0
                            ? "bg-phyt-pink-soft"
                            : "bg-phyt-ink/5"
                      }`}
                    >
                      {delta > 0 ? "+" : ""}
                      {money(delta, c)}
                    </span>
                  </td>
                </tr>
              );
            })}

            <tr className="bg-phyt-ink/[0.03] font-medium">
              <td className="px-3 py-3">Total</td>
              <td />
              <Td>{money(totalBudget, c)}</Td>
              <Td>{money(totalRunRate, c)}</Td>
              <td />
              <Td>{money(totalProposed, c)}</Td>
              <td className="px-3 py-3 text-right tabular-nums">
                {scaleUp >= 0 ? "+" : ""}
                {scaleUp.toFixed(0)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-phyt-ink/50">
        {allocateMode
          ? `Splitting £${Math.round(targetTotal)}/day across enabled campaigns, weighted by profitable conversions.`
          : "Proposed budgets scale profitable campaigns (LTV:CAC ≥ 1.3, especially those hitting their cap) and trim those below break-even."}
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-3 text-right">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 text-right tabular-nums">{children}</td>;
}
