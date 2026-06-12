import type { DashboardData } from "@/lib/integrations/types";
import { money, num, pct } from "@/lib/format";

export default function SearchTermTable({ data }: { data: DashboardData }) {
  const c = data.currency;
  const rows = [...data.asa.searchTerms].sort((a, b) => b.spend - a.spend);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-phyt-ink/10 bg-phyt-blue-soft/40 px-5 py-6 text-sm text-phyt-ink/70">
        {data.asa.searchTermsError ? (
          <>
            <strong>Search-term report failed to load.</strong>{" "}
            <span className="text-phyt-ink/60">{data.asa.searchTermsError}</span>
          </>
        ) : (
          <>
            <strong>No search terms reported for this period.</strong> Apple only
            includes terms with roughly 10+ impressions, so short ranges or
            low-volume days can be empty — try a longer date range. Terms also
            only come from broad match and Search Match traffic.
          </>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-phyt-ink/10">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-phyt-ink/10 bg-phyt-ink/[0.02] text-left text-[11px] uppercase tracking-wide text-phyt-ink/55">
            <th className="px-3 py-3">Search term</th>
            <Th>Spent</Th>
            <Th>Impr.</Th>
            <Th>Taps</Th>
            <Th>Installs</Th>
            <Th>CPT</Th>
            <Th>TTR</Th>
            <Th>CPI</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x, i) => (
            <tr key={`${x.searchTerm}-${i}`} className="border-b border-phyt-ink/5 hover:bg-phyt-ink/[0.015]">
              <td className="px-3 py-2.5">
                <div className={x.searchTerm ? "font-medium" : "italic text-phyt-ink/45"}>
                  {x.searchTerm || "Hidden by Apple (low-volume term)"}
                </div>
                <div className="text-[11px] text-phyt-ink/50">
                  {x.matchedKeyword ? `matched: ${x.matchedKeyword} · ` : ""}
                  {x.matchType} · {x.campaignName}
                </div>
              </td>
              <Td>{money(x.spend, c)}</Td>
              <Td>{num(x.impressions)}</Td>
              <Td>{num(x.taps)}</Td>
              <Td>{num(x.installs)}</Td>
              <Td>{money(x.cpt, c)}</Td>
              <Td>{pct(x.ttr)}</Td>
              <Td>{money(x.cpa, c)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-3 text-right">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 text-right tabular-nums">{children}</td>;
}
