import type { DashboardData } from "@/lib/integrations/types";
import { money, num, pct, ratio } from "@/lib/format";

/**
 * Colour a campaign's CPI against the target: green at/under target, amber up to
 * 30% over, red beyond that (or spending with no installs at all). This is the
 * "where to focus" signal — CPI is reliable at low volume, LTV:CAC isn't.
 */
function cpiTint(cpa: number, installs: number, target: number): string {
  if (installs === 0) return "bg-phyt-pink-soft";
  if (cpa <= target) return "bg-phyt-green-soft";
  if (cpa <= target * 1.3) return "bg-phyt-yellow-soft";
  return "bg-phyt-pink-soft";
}

export default function CampaignTable({ data }: { data: DashboardData }) {
  const { asa, ltv, currency, kpis } = data;
  const c = currency;
  const tCpi = kpis.find((k) => k.metric === "cpa")?.target ?? 12;

  // Sort by installs first, then spend (both descending).
  const campaigns = [...asa.campaigns].sort(
    (a, b) => b.installs - a.installs || b.spend - a.spend,
  );

  // Totals row.
  const sum = (f: (x: (typeof asa.campaigns)[number]) => number) =>
    asa.campaigns.reduce((a, x) => a + f(x), 0);
  const tSpend = asa.totals.spend;
  const tInstalls = asa.totals.installs;
  const tTrials = sum((x) => x.trials);
  const tSubs = sum((x) => x.subscriptions);
  const totalCostPerSub = tSubs ? tSpend / tSubs : 0;

  return (
    <div>
    <div className="overflow-x-auto rounded-2xl border border-phyt-ink/10">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="border-b border-phyt-ink/10 bg-phyt-ink/[0.02] text-left text-[11px] uppercase tracking-wide text-phyt-ink/55">
            <th className="px-3 py-3">Campaign</th>
            <Th>Spent</Th>
            <Th>Impr.</Th>
            <Th>Taps</Th>
            <Th>Installs</Th>
            <Th>CPT</Th>
            <Th>TTR</Th>
            <Th>CPI</Th>
            <Th>CR</Th>
            <Th>Trials</Th>
            <Th>Cost/Trial</Th>
            <Th>Subs</Th>
            <Th>Cost/Sub</Th>
            <Th>LTV</Th>
            <Th>LTV:CAC</Th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((x) => (
            <tr key={x.id} className="border-b border-phyt-ink/5 hover:bg-phyt-ink/[0.015]">
              <td className="px-3 py-2.5">
                <div className="font-medium">{x.name}</div>
                {x.status !== "ENABLED" && (
                  <span className="rounded-full bg-phyt-pink-soft px-2 py-0.5 text-[10px] uppercase">
                    {x.status.toLowerCase()}
                  </span>
                )}
              </td>
              <Td>{money(x.spend, c)}</Td>
              <Td>{num(x.impressions)}</Td>
              <Td>{num(x.taps)}</Td>
              <Td>{num(x.installs)}</Td>
              <Td>{money(x.cpt, c)}</Td>
              <Td>{pct(x.ttr)}</Td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                <span
                  title={`Target CPI ${money(tCpi, c)}`}
                  className={`rounded-full px-2 py-0.5 text-xs ${cpiTint(x.cpa, x.installs, tCpi)}`}
                >
                  {money(x.cpa, c)}
                </span>
              </td>
              <Td>{pct(x.conversionRate)}</Td>
              <Td>{num(x.trials)}</Td>
              <Td>{money(x.costPerTrial, c)}</Td>
              <Td>{num(x.subscriptions)}</Td>
              <Td>{money(x.costPerSub, c)}</Td>
              <Td>{money(ltv.blendedLtv, c)}</Td>
              {/* LTV:CAC shown but not colour-flagged — too noisy at low volume. */}
              <Td>{x.subscriptions > 0 ? ratio(x.ltvCac) : "—"}</Td>
            </tr>
          ))}

          {/* Totals */}
          <tr className="bg-phyt-ink/[0.03] font-medium">
            <td className="px-3 py-3">Total</td>
            <Td>{money(tSpend, c)}</Td>
            <Td>{num(asa.totals.impressions)}</Td>
            <Td>{num(asa.totals.taps)}</Td>
            <Td>{num(tInstalls)}</Td>
            <Td>{money(asa.totals.cpt, c)}</Td>
            <Td>{pct(asa.totals.ttr)}</Td>
            <Td>{money(asa.totals.cpa, c)}</Td>
            <Td>{pct(asa.totals.conversionRate)}</Td>
            <Td>{num(tTrials)}</Td>
            <Td>{money(tTrials ? tSpend / tTrials : 0, c)}</Td>
            <Td>{num(tSubs)}</Td>
            <Td>{money(totalCostPerSub, c)}</Td>
            <Td>{money(ltv.blendedLtv, c)}</Td>
            <Td>{ratio(totalCostPerSub ? ltv.blendedLtv / totalCostPerSub : 0)}</Td>
          </tr>
        </tbody>
      </table>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-phyt-ink/55">
      <span>CPI vs {money(tCpi, c)} target:</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-phyt-green-soft" /> at / under
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-phyt-yellow-soft" /> up to 30% over
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-phyt-pink-soft" /> well over / no installs
      </span>
    </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-3 text-right">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 text-right tabular-nums">{children}</td>;
}
