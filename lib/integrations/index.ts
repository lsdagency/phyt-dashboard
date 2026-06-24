import { and, desc, eq, gt } from "drizzle-orm";
import { db, dbAvailable, schema } from "../db";
import { listKpis } from "../repo";
import { resolveEnv } from "../credentials";
import type { DashboardData, DateRange } from "./types";
import { getAsaData } from "./asa";
import { getRevenueCatData } from "./revenuecat";
import { getPostHogData } from "./posthog";
import { deriveRevenue } from "./derive";
import { heuristicOptimisation, applyOptimisation } from "../optimise";

export * from "./types";

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Default range: the last `days` days, inclusive, ending today (UTC). */
export function defaultRange(days = 7): DateRange {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** Today's date (YYYY-MM-DD) in a given IANA timezone. */
function todayInTz(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Yesterday as a single-day range, anchored to the client's timezone. */
export function yesterdayRange(tz = "UTC"): DateRange {
  const d = new Date(todayInTz(tz) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.toISOString().slice(0, 10);
  return { start: y, end: y };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse + validate a range from query params, falling back to the default. */
export function parseRange(
  startParam?: string | null,
  endParam?: string | null,
): DateRange {
  if (startParam && endParam && ISO_DATE.test(startParam) && ISO_DATE.test(endParam)) {
    return startParam <= endParam
      ? { start: startParam, end: endParam }
      : { start: endParam, end: startParam };
  }
  return defaultRange();
}

// ---- light cache of LIVE results (sample data is never cached) ----
async function cached<T extends { source: string }>(
  source: "asa" | "revenuecat" | "posthog",
  range: DateRange,
  fetcher: () => Promise<T>,
  refresh = false,
): Promise<T> {
  const key = `${range.start}_${range.end}`;

  if (!refresh && dbAvailable && db) {
    const rows = await db
      .select()
      .from(schema.metricCache)
      .where(
        and(
          eq(schema.metricCache.source, source),
          eq(schema.metricCache.cacheKey, key),
          gt(schema.metricCache.fetchedAt, new Date(Date.now() - CACHE_TTL_MS)),
        ),
      )
      .orderBy(desc(schema.metricCache.fetchedAt))
      .limit(1);
    if (rows[0]) return rows[0].payload as T;
  }

  const data = await fetcher();

  if (dbAvailable && db && data.source === "live") {
    await db.insert(schema.metricCache).values({ source, cacheKey: key, payload: data });
  }
  return data;
}

/** Fetch the full normalised dashboard payload for a date range. */
export async function getDashboardData(
  range: DateRange,
  opts: { refresh?: boolean } = {},
): Promise<DashboardData> {
  const refresh = opts.refresh ?? false;
  const env = await resolveEnv();
  const [asa, revenueCat, posthog, kpis] = await Promise.all([
    cached("asa", range, () => getAsaData(range, env), refresh),
    cached("revenuecat", range, () => getRevenueCatData(range, env), refresh),
    cached("posthog", range, () => getPostHogData(range, env), refresh),
    listKpis(),
  ]);

  // Period trial/sub starts: RevenueCat's overview can't provide them, so use
  // PostHog conversion events when live (the only range-scoped source we have).
  if (posthog.source === "live") {
    if (!revenueCat.trialsStarted) {
      revenueCat.trialsStarted = posthog.trialsStarted ?? 0;
    }
    if (!revenueCat.subscriptionsStarted) {
      revenueCat.subscriptionsStarted = posthog.subscriptionsStarted ?? 0;
    }
  }

  // Attach revenue-derived fields (cost per trial/sub, LTV:CAC) + blended LTV.
  const ltv = deriveRevenue(asa, revenueCat);

  // Daily trials/subs series, scaled from daily installs to match attributed totals.
  const totalTrials = asa.campaigns.reduce((a, c) => a + c.trials, 0);
  const totalSubs = asa.campaigns.reduce((a, c) => a + c.subscriptions, 0);
  const trialRate = totalTrials / Math.max(asa.totals.installs, 1);
  const subRate = totalSubs / Math.max(totalTrials, 1);
  const dailyConversions = asa.timeseries.map((p) => {
    const trials = Math.round((p.installs as number) * trialRate);
    return { date: p.date, trials, subs: Math.round(trials * subRate) };
  });

  const data: DashboardData = {
    range,
    generatedAt: new Date().toISOString(),
    currency: asa.currency || ltv.currency,
    asa,
    revenueCat,
    posthog,
    ltv,
    kpis: kpis.map((k) => ({ metric: k.metric, target: k.target, direction: k.direction })),
    dailyConversions,
    // Placeholder; replaced by the heuristic below (Claude version generated on demand).
    optimisation: {
      forDate: range.end,
      generatedBy: "heuristic",
      summary: "",
      bidRecommendations: [],
      pauseRecommendations: [],
      structuralRecommendations: [],
    },
  };

  // Rules-based optimisation — deterministic, instant, no API key needed.
  const optimisation = heuristicOptimisation(data);
  applyOptimisation(data, optimisation);
  data.optimisation = optimisation;

  return data;
}
