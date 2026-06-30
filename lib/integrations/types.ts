/**
 * Normalised shapes returned by every integration. The dashboard and the daily
 * email only ever see these — never raw ASA/RevenueCat/PostHog payloads — so the
 * UI is decoupled from each provider's API quirks.
 */

export interface DateRange {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}

export type SourceMode = "live" | "sample";

export interface SeriesPoint {
  date: string;
  [metric: string]: string | number;
}

// ---------- Apple Search Ads ----------
export interface AsaTotals {
  spend: number;
  impressions: number;
  taps: number;
  installs: number;
  ttr: number; // tap-through rate %
  cpt: number; // avg cost per tap
  cpa: number; // avg cost per install
  conversionRate: number; // taps -> installs %
}

export interface AsaCampaign extends AsaTotals {
  id: string;
  name: string;
  status: string;
  dailyBudget: number; // configured daily cap (ASA campaign budget); 0 if unknown
  // Revenue attribution (true per-campaign when RevenueCat attribution is wired;
  // otherwise estimated by install share). Derived fields filled by derive.ts.
  trials: number;
  subscriptions: number;
  costPerTrial: number;
  costPerSub: number;
  ltvCac: number; // blended LTV / cost-per-sub
}

export type BidAction = "increase" | "decrease" | "hold";

export interface AsaKeyword {
  campaignId: string;
  campaignName: string;
  keywordId: string;
  keyword: string;
  matchType: string;
  bid: number;
  spend: number;
  impressions: number;
  taps: number;
  installs: number;
  ttr: number;
  cpt: number;
  cpa: number;
  trials: number;
  subscriptions: number;
  costPerTrial: number;
  costPerSub: number;
  // Proposed bid from the rules engine (applyBidLogic), set for every keyword.
  proposedBid: number | null;
  bidAction: BidAction | null;
  bidRationale?: string; // plain-English why, shown on hover in the keyword table
}

export interface AsaSearchTerm {
  campaignId: string;
  campaignName: string;
  searchTerm: string;
  matchedKeyword: string | null;
  matchType: string;
  spend: number;
  impressions: number;
  taps: number;
  installs: number;
  ttr: number;
  cpt: number;
  cpa: number;
}

export interface AsaData {
  source: SourceMode;
  error?: string;
  searchTermsError?: string; // search-term report failed even though campaigns/keywords loaded
  currency: string;
  totals: AsaTotals;
  campaigns: AsaCampaign[];
  keywords: AsaKeyword[];
  searchTerms: AsaSearchTerm[];
  timeseries: SeriesPoint[]; // { date, spend, installs, taps }
}

// ---------- RevenueCat ----------
export interface RevenueCatData {
  source: SourceMode;
  error?: string;
  currency: string;
  mrr: number;
  revenue: number; // over the period
  activeSubscriptions: number;
  activeTrials: number;
  newCustomers: number;
  trialsStarted: number; // started within the period
  subscriptionsStarted: number; // started within the period
  trialConversionRate: number; // %
  annualShare: number; // 0..1 of active subs on the annual plan
  monthlyShare: number; // 0..1 on the monthly plan
  ltv: number;
  timeseries: SeriesPoint[]; // { date, revenue, activeSubscriptions }
}

// ---------- PostHog ----------
export interface PostHogEventCount {
  event: string;
  count: number;
}

export interface PostHogData {
  source: SourceMode;
  error?: string;
  activeUsers: number; // unique over the period
  dau: number; // most recent day
  totalEvents: number;
  retentionRate: number; // % (day-7 style, sampled)
  topEvents: PostHogEventCount[];
  timeseries: SeriesPoint[]; // { date, activeUsers, events }
  // Period conversion counts from trial/purchase events (incl. RevenueCat's
  // forwarded $rc_* events). Undefined in sample mode.
  trialsStarted?: number;
  subscriptionsStarted?: number;
  conversionEvents?: PostHogEventCount[]; // the matched events, for mapping/debugging
}

// ---------- LTV ----------
export interface LtvSummary {
  currency: string;
  annualLtv: number;
  monthlyLtv: number;
  annualShare: number;
  monthlyShare: number;
  blendedLtv: number;
}

// ---------- KPI targets (for grading on the dashboard) ----------
export interface KpiTarget {
  metric: string;
  target: number;
  direction: "up" | "down";
}

// ---------- Optimisation (Claude / heuristic) ----------
export interface BidRecommendation {
  keywordId: string;
  keyword: string;
  campaignName: string;
  matchType: string;
  currentBid: number;
  proposedBid: number;
  action: "increase" | "decrease";
  rationale: string;
}

export interface PauseRecommendation {
  campaignId: string;
  campaignName: string;
  rationale: string;
}

export interface StructuralRecommendation {
  type: "add_keyword" | "negative_keyword" | "other";
  title: string;
  detail: string;
}

export interface Optimisation {
  forDate: string;
  generatedBy: "claude" | "heuristic";
  model?: string;
  summary: string;
  bidRecommendations: BidRecommendation[];
  pauseRecommendations: PauseRecommendation[];
  structuralRecommendations: StructuralRecommendation[];
}

// ---------- aggregate ----------
export interface DashboardData {
  range: DateRange;
  generatedAt: string;
  currency: string;
  asa: AsaData;
  revenueCat: RevenueCatData;
  posthog: PostHogData;
  ltv: LtvSummary;
  kpis: KpiTarget[];
  dailyConversions: SeriesPoint[]; // { date, trials, subs } — derived, consistent with totals
  optimisation: Optimisation; // baseline heuristic; Claude version generated on demand / daily
}
