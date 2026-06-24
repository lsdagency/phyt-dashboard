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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-phyt-ink/55">{label}</div>
      <div className="mt-0.5 font-display text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

/** One side of the paid-vs-all conversion comparison. Null values render as "—". */
function ConversionPanel({
  title,
  subtitle,
  accent,
  currency,
  trials,
  subs,
  costPerTrial,
  costPerSub,
  ltvCac,
}: {
  title: string;
  subtitle: string;
  accent: string;
  currency: string;
  trials: number | null;
  subs: number | null;
  costPerTrial: number | null;
  costPerSub: number | null;
  ltvCac: number | null;
}) {
  const m = (v: number | null) => (v === null ? "—" : money(v, currency));
  const n = (v: number | null) => (v === null ? "—" : num(v));
  const r = (v: number | null) => (v === null ? "—" : ratio(v));
  return (
    <div className="rounded-2xl border border-phyt-ink/10 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        <h3 className="font-display text-lg font-bold">{title}</h3>
      </div>
      <p className="mt-0.5 text-xs text-phyt-ink/55">{subtitle}</p>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MiniStat label="Trials" value={n(trials)} />
        <MiniStat label="Subscriptions" value={n(subs)} />
        <MiniStat label="Cost / trial" value={m(costPerTrial)} />
        <MiniStat label="Cost / sub" value={m(costPerSub)} />
        <MiniStat label="LTV : CAC" value={r(ltvCac)} />
      </div>
    </div>
  );
}

export default function KpiCards({ data }: { data: DashboardData }) {
  const { asa, revenueCat, ltv, kpis, currency } = data;
  const t = asa.totals;

  // ALL — currently active (RevenueCat is the source of truth for active counts).
  const allTrials = revenueCat.activeTrials;
  const allSubs = revenueCat.activeSubscriptions;
  const allCostPerTrial = allTrials ? t.spend / allTrials : null;
  const allCostPerSub = allSubs ? t.spend / allSubs : null;
  const allLtvCac = allCostPerSub ? ltv.blendedLtv / allCostPerSub : null;

  // PAID — ASA-attributed, summed from the per-campaign attribution (period).
  const paidTrials = asa.campaigns.reduce((a, c) => a + c.trials, 0);
  const paidSubs = asa.campaigns.reduce((a, c) => a + c.subscriptions, 0);
  const paid = {
    trials: paidTrials,
    subs: paidSubs,
    costPerTrial: paidTrials ? t.spend / paidTrials : null,
    costPerSub: paidSubs ? t.spend / paidSubs : null,
    ltvCac: paidSubs ? ltv.blendedLtv / (t.spend / paidSubs) : null,
  };

  return (
    <div className="space-y-3">
      {/* Acquisition top row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="Amount spent" value={money(t.spend, currency)} />
        <Card label="Installs" value={num(t.installs)} g={grade(kpis, "installs", t.installs)} />
        <Card label="CPT" value={money(t.cpt, currency)} g={grade(kpis, "cpt", t.cpt)} />
        <Card label="CPI" value={money(t.cpa, currency)} g={grade(kpis, "cpa", t.cpa)} />
        <Card label="TTR" value={pct(t.ttr)} g={grade(kpis, "ttr", t.ttr)} />
        <Card label="CR" value={pct(t.conversionRate)} g={grade(kpis, "cr", t.conversionRate)} />
      </div>

      {/* Paid (ASA) vs All (active) conversions */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ConversionPanel
          title="Paid — ASA only"
          subtitle="Subscriptions & trials attributed to Apple Search Ads"
          accent="bg-phyt-yellow"
          currency={currency}
          trials={paid.trials}
          subs={paid.subs}
          costPerTrial={paid.costPerTrial}
          costPerSub={paid.costPerSub}
          ltvCac={paid.ltvCac}
        />
        <ConversionPanel
          title="All — active"
          subtitle="RevenueCat active trials & subscriptions (all channels)"
          accent="bg-phyt-green-soft"
          currency={currency}
          trials={allTrials}
          subs={allSubs}
          costPerTrial={allCostPerTrial}
          costPerSub={allCostPerSub}
          ltvCac={allLtvCac}
        />
      </div>
    </div>
  );
}
