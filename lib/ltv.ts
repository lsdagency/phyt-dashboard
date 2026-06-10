/**
 * LTV assumptions for PHYT.
 *
 * Single-renewal model (per the client's definition):
 *  - Annual £59.99 with one 50% renewal  →  £59.99 × 1.5 = £89.99 per subscriber
 *  - Monthly £9.99 with M6 retention      →  £9.99 × 6   = £59.94 per subscriber
 *
 * Blended LTV uses the live annual/monthly mix from RevenueCat.
 * These constants are the single source of truth — make them editable in Settings later.
 */
export const LTV_ASSUMPTIONS = {
  currency: "GBP",
  annualPrice: 59.99,
  annualRenewalMultiplier: 1.5, // one 50% renewal
  monthlyPrice: 9.99,
  monthlyLifetimeMonths: 6, // M6 retention
};

export const ANNUAL_LTV =
  LTV_ASSUMPTIONS.annualPrice * LTV_ASSUMPTIONS.annualRenewalMultiplier; // 89.985
export const MONTHLY_LTV =
  LTV_ASSUMPTIONS.monthlyPrice * LTV_ASSUMPTIONS.monthlyLifetimeMonths; // 59.94

export function blendedLtv(annualShare: number, monthlyShare: number): number {
  const total = annualShare + monthlyShare || 1;
  const a = annualShare / total;
  const m = monthlyShare / total;
  return Math.round((a * ANNUAL_LTV + m * MONTHLY_LTV) * 100) / 100;
}
