"use client";

import { useState } from "react";
import type { DashboardData } from "@/lib/integrations/types";
import { money, num, pct } from "@/lib/format";
import { usePagination, PaginationControls } from "./Pagination";

type SortKey = "spend" | "installs" | "subscriptions" | "cpa" | "costPerSub";

export default function KeywordTable({ data }: { data: DashboardData }) {
  const c = data.currency;
  const [sort, setSort] = useState<SortKey>("spend");

  const rows = [...data.asa.keywords].sort((a, b) => b[sort] - a[sort]);
  const pager = usePagination(rows, sort);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-phyt-ink/60">
        Sort by:
        {(
          [
            ["spend", "Spend"],
            ["installs", "Installs"],
            ["subscriptions", "Subs"],
            ["cpa", "CPI"],
            ["costPerSub", "Cost/Sub"],
          ] as [SortKey, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`rounded-full px-2.5 py-1 ${
              sort === k ? "bg-phyt-yellow font-medium" : "bg-phyt-ink/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-phyt-ink/10">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-phyt-ink/10 bg-phyt-ink/[0.02] text-left text-[11px] uppercase tracking-wide text-phyt-ink/55">
              <th className="px-3 py-3">Keyword</th>
              <Th>Bid</Th>
              <Th>CPT</Th>
              <Th>Spent</Th>
              <Th>Impr.</Th>
              <Th>Taps</Th>
              <Th>Installs</Th>
              <Th>CPI</Th>
              <Th>Trials</Th>
              <Th>Cost/Trial</Th>
              <Th>Subs</Th>
              <Th>Cost/Sub</Th>
              <Th>Proposed bid</Th>
            </tr>
          </thead>
          <tbody>
            {pager.pageRows.map((x) => (
              <tr key={x.keywordId} className="border-b border-phyt-ink/5 hover:bg-phyt-ink/[0.015]">
                <td className="px-3 py-2.5">
                  <div className="font-medium">{x.keyword}</div>
                  <div className="text-[11px] text-phyt-ink/50">
                    {x.matchType} · {x.campaignName}
                  </div>
                </td>
                <Td>{money(x.bid, c)}</Td>
                <Td>{money(x.cpt, c)}</Td>
                <Td>{money(x.spend, c)}</Td>
                <Td>{num(x.impressions)}</Td>
                <Td>{num(x.taps)}</Td>
                <Td>{num(x.installs)}</Td>
                <Td>{money(x.cpa, c)}</Td>
                <Td>{num(x.trials)}</Td>
                <Td>{money(x.costPerTrial, c)}</Td>
                <Td>{num(x.subscriptions)}</Td>
                <Td>{money(x.costPerSub, c)}</Td>
                <td className="px-3 py-2.5 text-right">
                  <ProposedBid
                    proposed={x.proposedBid}
                    action={x.bidAction}
                    rationale={x.bidRationale}
                    currency={c}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls {...pager} />
      <p className="mt-1 text-xs text-phyt-ink/50">
        Proposed bids are calculated by the rules engine from each keyword&apos;s
        cost-per-sub vs LTV (once it has 5+ subs) and CPI vs target otherwise.
        Hover a proposed bid to see the reasoning.
      </p>
    </div>
  );
}

function ProposedBid({
  proposed,
  action,
  rationale,
  currency,
}: {
  proposed: number | null;
  action: "increase" | "decrease" | "hold" | null;
  rationale?: string;
  currency: string;
}) {
  if (proposed == null) return <span className="text-phyt-ink/30">—</span>;
  const tint =
    action === "increase"
      ? "bg-phyt-green-soft"
      : action === "decrease"
        ? "bg-phyt-pink-soft"
        : "bg-phyt-ink/5";
  const arrow = action === "increase" ? "↑" : action === "decrease" ? "↓" : "→";
  return (
    <span
      title={rationale}
      className={`cursor-help rounded-full px-2.5 py-0.5 text-xs tabular-nums ${tint}`}
    >
      {arrow} {money(proposed, currency)}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-3 text-right">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 text-right tabular-nums">{children}</td>;
}
