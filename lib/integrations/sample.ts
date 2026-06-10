import type {
  AsaData,
  DateRange,
  PostHogData,
  RevenueCatData,
  SeriesPoint,
} from "./types";

/**
 * Deterministic sample data so the dashboard is fully usable before real API keys
 * are set. Seeded by date string, so reloads show stable (not flickering) numbers.
 */

// Small seeded PRNG (mulberry32) — stable output for a given seed.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function eachDate(range: DateRange): string[] {
  const out: string[] = [];
  const start = new Date(range.start + "T00:00:00Z");
  const end = new Date(range.end + "T00:00:00Z");
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out.length ? out : [range.end];
}

const round = (n: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

const SAMPLE_CAMPAIGNS = [
  { id: "1001", name: "PHYT — Brand (Exact)", status: "ENABLED" },
  { id: "1002", name: "PHYT — Fitness Discovery (Broad)", status: "ENABLED" },
  { id: "1003", name: "PHYT — Competitor Conquest", status: "ENABLED" },
  { id: "1004", name: "PHYT — Today Tab", status: "PAUSED" },
];

const SAMPLE_KEYWORDS: { campaign: number; kw: string; match: string }[] = [
  { campaign: 0, kw: "phyt", match: "EXACT" },
  { campaign: 0, kw: "phyt app", match: "EXACT" },
  { campaign: 1, kw: "workout tracker", match: "BROAD" },
  { campaign: 1, kw: "fitness app", match: "BROAD" },
  { campaign: 1, kw: "gym log", match: "BROAD" },
  { campaign: 1, kw: "running tracker", match: "BROAD" },
  { campaign: 2, kw: "strava", match: "BROAD" },
  { campaign: 2, kw: "strong app", match: "BROAD" },
  { campaign: 2, kw: "fitbod", match: "EXACT" },
];

const SAMPLE_TERMS = [
  "phyt",
  "phyt fitness",
  "best workout tracker 2026",
  "free gym log app",
  "running tracker no subscription",
  "strava alternative",
  "weightlifting tracker",
  "fitness app with apple watch",
];

export function sampleAsa(range: DateRange): AsaData {
  const dates = eachDate(range);
  const seed = seedFromString("asa" + range.start + range.end);
  const r = rng(seed);

  const timeseries: SeriesPoint[] = dates.map((date, i) => {
    const dr = rng(seedFromString(date));
    const impressions = Math.round(8000 + dr() * 6000 + Math.sin(i / 3) * 1500);
    const taps = Math.round(impressions * (0.05 + dr() * 0.03));
    const installs = Math.round(taps * (0.28 + dr() * 0.12));
    const spend = round(taps * (1.1 + dr() * 0.7));
    return { date, spend, installs, taps, impressions };
  });

  const sum = (k: keyof SeriesPoint) =>
    timeseries.reduce((a, p) => a + (p[k] as number), 0);
  const impressions = sum("impressions");
  const taps = sum("taps");
  const installs = sum("installs");
  const spend = round(sum("spend"));

  // Per-campaign trial rate (install -> trial) and trial->sub rate. Brand converts best.
  const TRIAL_RATE = [0.46, 0.3, 0.24, 0.2];
  const SUB_RATE = [0.55, 0.42, 0.36, 0.34];

  const campaigns = SAMPLE_CAMPAIGNS.map((c, idx) => {
    const share = [0.18, 0.4, 0.3, 0.12][idx];
    const cImpr = Math.round(impressions * share);
    const cTaps = Math.round(taps * share * (0.9 + r() * 0.2));
    const cInst = Math.round(installs * share * (0.9 + r() * 0.2));
    const cSpend = round(spend * share);
    const trials = Math.round(cInst * TRIAL_RATE[idx]);
    const subscriptions = Math.round(trials * SUB_RATE[idx]);
    // Daily budget ~ current daily spend with a little headroom, rounded to £10.
    const avgDailySpend = cSpend / Math.max(dates.length, 1);
    const dailyBudget =
      c.status === "PAUSED"
        ? Math.round((avgDailySpend * 1.2) / 10) * 10
        : Math.max(10, Math.round((avgDailySpend * 1.15) / 10) * 10);
    return {
      ...c,
      impressions: cImpr,
      taps: cTaps,
      installs: cInst,
      spend: cSpend,
      dailyBudget,
      ttr: round((cTaps / Math.max(cImpr, 1)) * 100),
      cpt: round(cSpend / Math.max(cTaps, 1)),
      cpa: round(cSpend / Math.max(cInst, 1)),
      conversionRate: round((cInst / Math.max(cTaps, 1)) * 100),
      trials,
      subscriptions,
      // derived by derive.ts (costPerTrial/costPerSub/ltvCac)
      costPerTrial: 0,
      costPerSub: 0,
      ltvCac: 0,
    };
  });

  const keywords = SAMPLE_KEYWORDS.map((k, idx) => {
    const kr = rng(seedFromString(k.kw + range.end));
    const kTaps = Math.round(20 + kr() * 240);
    const kImpr = Math.round(kTaps * (12 + kr() * 18));
    const kInst = Math.round(kTaps * (0.2 + kr() * 0.25));
    const kSpend = round(kTaps * (0.9 + kr() * 1.1));
    const camp = SAMPLE_CAMPAIGNS[k.campaign];
    const kTrials = Math.round(kInst * (0.2 + kr() * 0.25));
    const kSubs = Math.round(kTrials * (0.35 + kr() * 0.2));
    return {
      campaignId: camp.id,
      campaignName: camp.name,
      keywordId: `kw-${idx}`,
      keyword: k.kw,
      matchType: k.match,
      bid: round(0.8 + kr() * 2.5),
      spend: kSpend,
      impressions: kImpr,
      taps: kTaps,
      installs: kInst,
      ttr: round((kTaps / Math.max(kImpr, 1)) * 100),
      cpt: round(kSpend / Math.max(kTaps, 1)),
      cpa: round(kSpend / Math.max(kInst, 1)),
      trials: kTrials,
      subscriptions: kSubs,
      costPerTrial: 0,
      costPerSub: 0,
      proposedBid: null,
      bidAction: null,
    };
  });

  const searchTerms = SAMPLE_TERMS.map((term, idx) => {
    const tr = rng(seedFromString(term + range.end));
    const tTaps = Math.round(5 + tr() * 90);
    const tImpr = Math.round(tTaps * (10 + tr() * 20));
    const tInst = Math.round(tTaps * (0.15 + tr() * 0.3));
    const tSpend = round(tTaps * (0.9 + tr() * 1.2));
    const kw = SAMPLE_KEYWORDS[idx % SAMPLE_KEYWORDS.length];
    const camp = SAMPLE_CAMPAIGNS[kw.campaign];
    return {
      campaignId: camp.id,
      campaignName: camp.name,
      searchTerm: term,
      matchedKeyword: kw.kw,
      matchType: kw.match,
      spend: tSpend,
      impressions: tImpr,
      taps: tTaps,
      installs: tInst,
      ttr: round((tTaps / Math.max(tImpr, 1)) * 100),
      cpt: round(tSpend / Math.max(tTaps, 1)),
      cpa: round(tSpend / Math.max(tInst, 1)),
    };
  });

  return {
    source: "sample",
    currency: "GBP",
    totals: {
      spend,
      impressions,
      taps,
      installs,
      ttr: round((taps / Math.max(impressions, 1)) * 100),
      cpt: round(spend / Math.max(taps, 1)),
      cpa: round(spend / Math.max(installs, 1)),
      conversionRate: round((installs / Math.max(taps, 1)) * 100),
    },
    campaigns,
    keywords,
    searchTerms,
    timeseries,
  };
}

export function sampleRevenueCat(range: DateRange): RevenueCatData {
  const dates = eachDate(range);
  const baseSubs = 2400;
  const timeseries: SeriesPoint[] = dates.map((date, i) => {
    const dr = rng(seedFromString("rc" + date));
    const activeSubscriptions = Math.round(baseSubs + i * 12 + dr() * 60);
    const revenue = round(activeSubscriptions * (0.18 + dr() * 0.05));
    return { date, revenue, activeSubscriptions };
  });
  const revenue = round(timeseries.reduce((a, p) => a + (p.revenue as number), 0));
  const activeSubscriptions = timeseries[timeseries.length - 1]
    .activeSubscriptions as number;
  const r = rng(seedFromString("rc" + range.end));
  const newCustomers = Math.round(dates.length * (30 + r() * 25));
  const trialsStarted = Math.round(newCustomers * (0.55 + r() * 0.15));
  const subscriptionsStarted = Math.round(trialsStarted * (0.38 + r() * 0.14));
  return {
    source: "sample",
    currency: "GBP",
    mrr: round(activeSubscriptions * 7.2),
    revenue,
    activeSubscriptions,
    activeTrials: Math.round(180 + r() * 120),
    newCustomers,
    trialsStarted,
    subscriptionsStarted,
    trialConversionRate: round(32 + r() * 12),
    annualShare: 0.25,
    monthlyShare: 0.75,
    ltv: round(48 + r() * 22),
    timeseries,
  };
}

export function samplePostHog(range: DateRange): PostHogData {
  const dates = eachDate(range);
  const timeseries: SeriesPoint[] = dates.map((date, i) => {
    const dr = rng(seedFromString("ph" + date));
    const activeUsers = Math.round(1200 + i * 8 + dr() * 300);
    const events = Math.round(activeUsers * (14 + dr() * 6));
    return { date, activeUsers, events };
  });
  const totalEvents = timeseries.reduce((a, p) => a + (p.events as number), 0);
  const r = rng(seedFromString("ph" + range.end));
  return {
    source: "sample",
    activeUsers: Math.round(9000 + r() * 2000),
    dau: timeseries[timeseries.length - 1].activeUsers as number,
    totalEvents,
    retentionRate: round(38 + r() * 10),
    topEvents: [
      { event: "app_open", count: Math.round(totalEvents * 0.34) },
      { event: "workout_started", count: Math.round(totalEvents * 0.19) },
      { event: "workout_completed", count: Math.round(totalEvents * 0.14) },
      { event: "paywall_viewed", count: Math.round(totalEvents * 0.08) },
      { event: "subscription_started", count: Math.round(totalEvents * 0.03) },
    ],
    timeseries,
  };
}
