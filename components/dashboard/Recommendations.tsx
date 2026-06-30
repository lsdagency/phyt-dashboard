"use client";

import type { Optimisation } from "@/lib/integrations/types";

/**
 * Search-term opportunities only. Bid changes now live in the keyword table
 * (proposed bid per keyword) and campaign focus lives in the campaign table
 * (CPI colour-coding) — this panel just surfaces keywords to add or exclude.
 */
export default function Recommendations({
  optimisation,
}: {
  optimisation: Optimisation;
}) {
  const structural = optimisation.structuralRecommendations;

  return (
    <div className="rounded-2xl border border-phyt-ink/10 bg-white p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl">Search-term opportunities</h2>
        <span className="rounded-full bg-phyt-ink/5 px-2.5 py-0.5 text-[11px]">
          Rules-based
        </span>
      </div>
      <p className="mt-1 text-sm text-phyt-ink/55">
        Converting search terms worth adding as exact keywords, and wasteful ones
        worth adding as negatives.
      </p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {structural.length === 0 && (
          <li className="text-sm text-phyt-ink/50">
            No new search-term opportunities right now.
          </li>
        )}
        {structural.map((s, i) => (
          <li key={i} className="rounded-xl border border-phyt-ink/10 p-3">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                  s.type === "add_keyword"
                    ? "bg-phyt-green-soft"
                    : s.type === "negative_keyword"
                      ? "bg-phyt-pink-soft"
                      : "bg-phyt-blue-soft"
                }`}
              >
                {s.type.replace("_", " ")}
              </span>
              <span className="text-sm font-medium">{s.title}</span>
            </div>
            <p className="mt-1 text-xs text-phyt-ink/60">{s.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
