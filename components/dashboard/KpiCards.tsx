import type { DashboardData } from "@/lib/integrations/types";
import { money, num, pct, ratio } from "@/lib/format";

function grade(
  kpis: DashboardData["kpis"],
  metric: string,
  value: number,
): { meets: boolean; target: number } | null {
  const k = kpis.find((x) => x.metric === metric);
  if (!k) return null;
  const meets = k.direction === "up" ? value >= k.target : value <= k.target;
  return { meets, target: k.target };
}

function Card({
  label,
  value,
  sub,
  g,
}: {
  label: string;
  value: string;
  sub?: string;
  g?: { meets: boolean; target: number } | null;
}) {
  return (
    <div className="rounded-2xl border border-phyt-ink/10 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-phyt-ink/55">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
      <div className="mt-1 flex items-center gap-2">
        {sub && <span className="text-xs text-phyt-ink/55">{sub}</span>}
        {g && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              g.meets ? "bg-phyt-green-soft" : "bg-phyt-pink-soft"
            }`}
          >
            Target {g.target} {g.meets ? "✓" : "✗"}
          </span>
        )}
      </div>
    </div>
  );
}

export default function KpiCards({ data }: { data: DashboardData }) {
  const { asa, revenueCat, ltv, posthog, kpis, currency } = data;
  const t = asa.totals;
  const trials = asa.campaigns.reduce((a, c) => a + c.trials, 0);
  const subs = asa.campaigns.reduce((a, c) => a + c.subscriptions, 0);
  const costPerSub = subs ? t.spend / subs : 0;
  const blendedCac = costPerSub ? ltv.blendedLtv / costPerSub : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Card label="Amount spent" value={money(t.spend, currency)} />
      <Card label="Installs" value={num(t.installs)} g={grade(kpis, "installs", t.installs)} />
      <Card label="CPI" value={money(t.cpa, currency)} g={grade(kpis, "cpa", t.cpa)} />
      <Card label="CPT" value={money(t.cpt, currency)} g={grade(kpis, "cpt", t.cpt)} />
      <Card label="TTR" value={pct(t.ttr)} g={grade(kpis, "ttr", t.ttr)} />
      <Card
        label="Trials"
        value={num(trials)}
        sub={`${money(trials ? t.spend / trials : 0, currency)} / trial`}
      />
      <Card
        label="Subscriptions"
        value={num(subs)}
        sub={`${money(costPerSub, currency)} / sub`}
      />
      <Card label="MRR" value={money(revenueCat.mrr, currency)} />
      <Card
        label="Blended LTV : CAC"
        value={ratio(blendedCac)}
        sub={`LTV ${money(ltv.blendedLtv, currency)}`}
      />
      <Card label="Active users" value={num(posthog.activeUsers)} sub="period" />
    </div>
  );
}
