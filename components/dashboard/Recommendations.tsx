"use client";

import type { Optimisation } from "@/lib/integrations/types";
import { money } from "@/lib/format";

export default function Recommendations({
  optimisation,
  currency,
  canRegenerate,
  regenerating,
  onRegenerate,
}: {
  optimisation: Optimisation;
  currency: string;
  canRegenerate: boolean;
  regenerating: boolean;
  onRegenerate: () => void;
}) {
  const o = optimisation;
  const MAX_BIDS = 5;
  const MAX_STRUCTURAL = 3;
  const bumps = o.bidRecommendations.slice(0, MAX_BIDS);
  const extraBids = o.bidRecommendations.length - bumps.length;
  const structural = o.structuralRecommendations.slice(0, MAX_STRUCTURAL);
  const extraStructural = o.structuralRecommendations.length - structural.length;

  return (
    <div className="rounded-2xl border border-phyt-ink/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl">Daily optimisations</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] ${
              o.generatedBy === "claude" ? "bg-phyt-blue-soft" : "bg-phyt-ink/5"
            }`}
          >
            {o.generatedBy === "claude" ? `Claude${o.model ? ` · ${o.model}` : ""}` : "Heuristic baseline"}
          </span>
        </div>
        {canRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="rounded-lg bg-phyt-yellow px-3 py-2 text-sm font-display font-bold disabled:opacity-60"
          >
            {regenerating ? "Analysing…" : "✦ Regenerate with Claude"}
          </button>
        )}
      </div>

      <p className="mt-3 text-phyt-ink/80">{o.summary}</p>

      {/* Each block on its own row (stacked, full width) */}
      <div className="mt-5 space-y-6">
        {/* Bid changes — top 5 */}
        <div>
          <h3 className="text-sm font-display font-bold uppercase tracking-wide text-phyt-ink/60">
            Bid changes ({o.bidRecommendations.length})
          </h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {bumps.length === 0 && (
              <li className="text-sm text-phyt-ink/50">No bid changes recommended.</li>
            )}
            {bumps.map((b) => (
              <li key={b.keywordId} className="rounded-xl border border-phyt-ink/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{b.keyword}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                      b.action === "increase" ? "bg-phyt-green-soft" : "bg-phyt-pink-soft"
                    }`}
                  >
                    {money(b.currentBid, currency)} {b.action === "increase" ? "↑" : "↓"}{" "}
                    {money(b.proposedBid, currency)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-phyt-ink/60">{b.rationale}</p>
              </li>
            ))}
          </ul>
          {extraBids > 0 && (
            <p className="mt-2 text-xs text-phyt-ink/50">
              + {extraBids} more in the keyword table below.
            </p>
          )}
        </div>

        {/* Campaigns to review */}
        <div>
          <h3 className="text-sm font-display font-bold uppercase tracking-wide text-phyt-ink/60">
            Campaigns to review ({o.pauseRecommendations.length})
          </h3>
          <ul className="mt-2 space-y-2">
            {o.pauseRecommendations.length === 0 && (
              <li className="text-sm text-phyt-ink/50">None below break-even.</li>
            )}
            {o.pauseRecommendations.map((p) => (
              <li key={p.campaignId} className="rounded-xl bg-phyt-pink-soft p-3">
                <div className="font-medium">{p.campaignName}</div>
                <p className="mt-0.5 text-xs text-phyt-ink/70">{p.rationale}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Structural — top 3 */}
        <div>
          <h3 className="text-sm font-display font-bold uppercase tracking-wide text-phyt-ink/60">
            Structural opportunities ({o.structuralRecommendations.length})
          </h3>
          <ul className="mt-2 space-y-2">
            {structural.length === 0 && (
              <li className="text-sm text-phyt-ink/50">None identified.</li>
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
          {extraStructural > 0 && (
            <p className="mt-2 text-xs text-phyt-ink/50">+ {extraStructural} more.</p>
          )}
        </div>
      </div>
    </div>
  );
}
