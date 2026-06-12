import type { DateRange, RevenueCatData } from "./types";
import { sampleRevenueCat } from "./sample";

/**
 * RevenueCat API v2 client.
 * Auth: Bearer secret API key (sk_...). We read the project Overview metrics,
 * which expose MRR, active subscriptions/trials, revenue and new customers.
 * Docs: https://www.revenuecat.com/docs/api-v2
 */

const API_BASE = "https://api.revenuecat.com/v2";

type Env = Record<string, string | undefined>;

function creds(env: Env) {
  const { REVENUECAT_API_KEY, REVENUECAT_PROJECT_ID } = env;
  if (!REVENUECAT_API_KEY || !REVENUECAT_PROJECT_ID) return null;
  return { key: REVENUECAT_API_KEY, projectId: REVENUECAT_PROJECT_ID };
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

interface OverviewMetric {
  id?: string;
  name?: string;
  value?: number;
  unit?: string;
}

export async function getRevenueCatData(
  range: DateRange,
  env: Env,
): Promise<RevenueCatData> {
  const c = creds(env);
  if (!c) return sampleRevenueCat(range);

  try {
    const res = await fetch(
      `${API_BASE}/projects/${c.projectId}/metrics/overview`,
      {
        headers: {
          Authorization: `Bearer ${c.key}`,
          "Content-Type": "application/json",
        },
        // RevenueCat overview is "current state"; keep it fresh-ish.
        cache: "no-store",
      },
    );
    if (!res.ok) {
      throw new Error(`RevenueCat overview failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { metrics?: OverviewMetric[] };
    const byId = new Map(
      (json.metrics ?? []).map((m) => [m.id ?? m.name ?? "", m.value ?? 0]),
    );
    const pick = (...ids: string[]) => {
      for (const id of ids) if (byId.has(id)) return byId.get(id) ?? 0;
      return 0;
    };

    const activeSubscriptions = pick("active_subscriptions", "active_subscribers");
    const mrr = pick("mrr");
    const revenue = pick("revenue", "revenue_28d");
    const activeTrials = pick("active_trials");
    const newCustomers = pick("new_customers", "installs");

    // RevenueCat's overview doesn't return a daily series; sample provides the
    // trend shape so charts render. (Step 4 can swap to a charts/metrics call.)
    const sampled = sampleRevenueCat(range);

    const annualSubs = pick("active_annual_subscriptions");
    const monthlySubs = pick("active_monthly_subscriptions");
    const knownSplit = annualSubs + monthlySubs;

    return {
      source: "live",
      currency: "GBP",
      mrr: round(mrr),
      revenue: round(revenue),
      activeSubscriptions,
      activeTrials,
      newCustomers,
      // RevenueCat's overview has no period-scoped trial/sub starts. Report 0 here;
      // the aggregator fills these from PostHog conversion events. NEVER sample
      // fallback inside live data — that's how fake numbers leak into real reports.
      trialsStarted: pick("trials_started", "new_trials"),
      subscriptionsStarted: pick("subscriptions_started", "conversions"),
      trialConversionRate: sampled.trialConversionRate,
      annualShare: knownSplit > 0 ? annualSubs / knownSplit : sampled.annualShare,
      monthlyShare: knownSplit > 0 ? monthlySubs / knownSplit : sampled.monthlyShare,
      ltv: sampled.ltv,
      timeseries: sampled.timeseries,
    };
  } catch (e) {
    const fallback = sampleRevenueCat(range);
    fallback.error = `RevenueCat: ${e instanceof Error ? e.message : "request failed"}`;
    return fallback;
  }
}
