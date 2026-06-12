import type { AsaData, LtvSummary, RevenueCatData } from "./types";
import { ANNUAL_LTV, MONTHLY_LTV, blendedLtv } from "../ltv";

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * Apportion an integer total across items by weight, guaranteeing the parts
 * sum exactly to the total (largest-remainder method). Per-item rounding
 * inflates counts at small volumes — 4 campaigns × round(0.7) = 4 from a true 3.
 */
function apportion(total: number, weights: number[]): number[] {
  const sumW = weights.reduce((a, w) => a + w, 0);
  if (total <= 0 || sumW <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sumW);
  const floors = exact.map(Math.floor);
  let remainder = total - floors.reduce((a, n) => a + n, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  return floors;
}

/**
 * Fills the revenue-derived fields on ASA campaigns/keywords and returns the
 * blended LTV summary. For live ASA without real per-campaign attribution,
 * trials/subs are estimated from app-wide RevenueCat totals by install share.
 */
export function deriveRevenue(asa: AsaData, rc: RevenueCatData): LtvSummary {
  const ltv: LtvSummary = {
    currency: rc.currency || "GBP",
    annualLtv: round(ANNUAL_LTV),
    monthlyLtv: round(MONTHLY_LTV),
    annualShare: rc.annualShare,
    monthlyShare: rc.monthlyShare,
    blendedLtv: blendedLtv(rc.annualShare, rc.monthlyShare),
  };

  const estimating = asa.source === "live"; // sample data carries pre-attributed numbers

  if (estimating) {
    // Split app-wide period totals across campaigns/keywords by install share,
    // summing exactly to the totals (no per-row rounding inflation).
    const cWeights = asa.campaigns.map((c) => c.installs);
    const cTrials = apportion(rc.trialsStarted, cWeights);
    const cSubs = apportion(rc.subscriptionsStarted, cWeights);
    asa.campaigns.forEach((c, i) => {
      if (c.trials === 0) c.trials = cTrials[i];
      if (c.subscriptions === 0) c.subscriptions = cSubs[i];
    });

    const kWeights = asa.keywords.map((k) => k.installs);
    const kTrials = apportion(rc.trialsStarted, kWeights);
    const kSubs = apportion(rc.subscriptionsStarted, kWeights);
    asa.keywords.forEach((k, i) => {
      if (k.trials === 0) k.trials = kTrials[i];
      if (k.subscriptions === 0) k.subscriptions = kSubs[i];
    });
  }

  for (const c of asa.campaigns) {
    c.costPerTrial = c.trials ? round(c.spend / c.trials) : 0;
    c.costPerSub = c.subscriptions ? round(c.spend / c.subscriptions) : 0;
    c.ltvCac = c.costPerSub ? round(ltv.blendedLtv / c.costPerSub) : 0;
  }
  for (const k of asa.keywords) {
    k.costPerTrial = k.trials ? round(k.spend / k.trials) : 0;
    k.costPerSub = k.subscriptions ? round(k.spend / k.subscriptions) : 0;
  }

  return ltv;
}
