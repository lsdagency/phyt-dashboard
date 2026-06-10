import type { DashboardData } from "@/lib/integrations/types";
import { money, num, pct, ratio } from "@/lib/format";

export default function CampaignTable({ data }: { data: DashboardData }) {
  const { asa, ltv, currency } = data;
  const c = currency;

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
              <Td>{money(x.cpa, c)}</Td>
              <Td>{pct(x.conversionRate)}</Td>
              <Td>{num(x.trials)}</Td>
              <Td>{money(x.costPerTrial, c)}</Td>
              <Td>{num(x.subscriptions)}</Td>
              <Td>{money(x.costPerSub, c)}</Td>
              <Td>{money(ltv.blendedLtv, c)}</Td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    x.ltvCac >= 1 ? "bg-phyt-green-soft" : "bg-phyt-pink-soft"
                  }`}
                >
                  {ratio(x.ltvCac)}
                </span>
              </td>
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
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-3 text-right">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 text-right tabular-nums">{children}</td>;
}
