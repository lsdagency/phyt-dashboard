import type { AsaData, LtvSummary, RevenueCatData } from "./types";
import { ANNUAL_LTV, MONTHLY_LTV, blendedLtv } from "../ltv";

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

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

  const totalInstalls = asa.totals.installs || 1;
  const estimating = asa.source === "live"; // sample data carries real attributed numbers

  for (const c of asa.campaigns) {
    if (estimating && c.trials === 0) {
      c.trials = Math.round(rc.trialsStarted * (c.installs / totalInstalls));
    }
    if (estimating && c.subscriptions === 0) {
      c.subscriptions = Math.round(rc.subscriptionsStarted * (c.installs / totalInstalls));
    }
    c.costPerTrial = c.trials ? round(c.spend / c.trials) : 0;
    c.costPerSub = c.subscriptions ? round(c.spend / c.subscriptions) : 0;
    c.ltvCac = c.costPerSub ? round(ltv.blendedLtv / c.costPerSub) : 0;
  }

  for (const k of asa.keywords) {
    if (estimating && k.trials === 0) {
      k.trials = Math.round(rc.trialsStarted * (k.installs / totalInstalls));
    }
    if (estimating && k.subscriptions === 0) {
      k.subscriptions = Math.round(rc.subscriptionsStarted * (k.installs / totalInstalls));
    }
    k.costPerTrial = k.trials ? round(k.spend / k.trials) : 0;
    k.costPerSub = k.subscriptions ? round(k.spend / k.subscriptions) : 0;
  }

  return ltv;
}
