const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
};

export function money(n: number, currency = "GBP"): string {
  const sym = CURRENCY_SYMBOL[currency] ?? "";
  const v = Math.abs(n) >= 1000 ? Math.round(n) : Math.round(n * 100) / 100;
  return `${sym}${v.toLocaleString("en-GB", {
    minimumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function num(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}

export function pct(n: number, dp = 1): string {
  return `${n.toFixed(dp)}%`;
}

export function ratio(n: number): string {
  return `${n.toFixed(2)}:1`;
}
