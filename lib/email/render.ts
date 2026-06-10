import type { DashboardData, Optimisation } from "../integrations/types";
import { money, num, pct, ratio } from "../format";

/**
 * Renders the daily client email. Inline styles only (email clients strip
 * <style>/external CSS), PHYT palette, system-font stack (Clash Grotesk isn't
 * available in mail clients). Returns subject + HTML + plain-text fallback.
 */

const INK = "#002E29";
const YELLOW = "#F7E04A";
const GREEN_SOFT = "#D9F4E4";
const PINK_SOFT = "#FCE4EB";
const BLUE_SOFT = "#E3F4FB";
const BORDER = "#E2E6E5";

const prettyDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function renderDailyReport(
  data: DashboardData,
  opt: Optimisation,
  dashboardUrl: string,
): { subject: string; html: string; text: string } {
  const c = data.currency;
  const t = data.asa.totals;
  const trials = data.asa.campaigns.reduce((a, x) => a + x.trials, 0);
  const subs = data.asa.campaigns.reduce((a, x) => a + x.subscriptions, 0);
  const costPerSub = subs ? t.spend / subs : 0;
  const blendedCac = costPerSub ? data.ltv.blendedLtv / costPerSub : 0;

  const dateLabel =
    data.range.start === data.range.end
      ? prettyDate(data.range.end)
      : `${prettyDate(data.range.start)} – ${prettyDate(data.range.end)}`;

  const subject = `PHYT · App Store Ads report — ${prettyDate(data.range.end)}`;

  const kpis: [string, string][] = [
    ["Amount spent", money(t.spend, c)],
    ["Installs", num(t.installs)],
    ["CPI", money(t.cpa, c)],
    ["TTR", pct(t.ttr)],
    ["Trials", num(trials)],
    ["Subscriptions", num(subs)],
    ["MRR", money(data.revenueCat.mrr, c)],
    ["Blended LTV:CAC", ratio(blendedCac)],
  ];

  const cell = ([label, value]: [string, string]) => `
      <td width="25%" style="padding:10px;border:1px solid ${BORDER};border-radius:10px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5a6a66;">${label}</div>
        <div style="font-size:20px;font-weight:700;color:${INK};margin-top:4px;">${value}</div>
      </td>`;
  // 8 KPIs in two rows of four.
  const kpiTable = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate;">
      <tr>${kpis.slice(0, 4).map(cell).join("")}</tr>
      <tr>${kpis.slice(4, 8).map(cell).join("")}</tr>
    </table>`;

  const bidItems = opt.bidRecommendations
    .slice(0, 8)
    .map((b) => {
      const tint = b.action === "increase" ? GREEN_SOFT : PINK_SOFT;
      const arrow = b.action === "increase" ? "↑" : "↓";
      return `<li style="margin:0 0 8px;">
        <span style="background:${tint};border-radius:10px;padding:2px 8px;font-size:13px;">${b.keyword}: ${money(b.currentBid, c)} ${arrow} ${money(b.proposedBid, c)}</span>
        <div style="font-size:12px;color:#5a6a66;margin-top:3px;">${escapeHtml(b.rationale)}</div>
      </li>`;
    })
    .join("");

  const structuralItems = opt.structuralRecommendations
    .slice(0, 6)
    .map(
      (s) =>
        `<li style="margin:0 0 6px;font-size:13px;"><strong>${escapeHtml(s.title)}</strong><br><span style="color:#5a6a66;">${escapeHtml(s.detail)}</span></li>`,
    )
    .join("");

  const pauseItems = opt.pauseRecommendations
    .map(
      (p) =>
        `<li style="margin:0 0 6px;font-size:13px;"><strong>${escapeHtml(p.campaignName)}</strong> — <span style="color:#5a6a66;">${escapeHtml(p.rationale)}</span></li>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK};">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border:1px solid ${BORDER};border-radius:18px;overflow:hidden;">
      <div style="height:6px;background:linear-gradient(90deg,${YELLOW} 0 25%,#4ECC7C 25% 50%,#F6B0C6 50% 75%,#99DAEF 75% 100%);"></div>
      <div style="padding:24px;">
        <div style="font-size:26px;font-weight:800;letter-spacing:-.01em;">PHYT</div>
        <div style="color:#5a6a66;font-size:14px;">App Store Ads report · ${dateLabel}</div>

        <h2 style="font-size:16px;margin:22px 0 8px;">Performance</h2>
        ${kpiTable}

        <div style="background:${BLUE_SOFT};border-radius:12px;padding:14px 16px;margin:20px 0;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5a6a66;">${opt.generatedBy === "claude" ? "Claude's analysis" : "Optimisation summary"}</div>
          <div style="font-size:14px;margin-top:6px;">${escapeHtml(opt.summary)}</div>
        </div>

        ${
          bidItems
            ? `<h2 style="font-size:16px;margin:20px 0 8px;">Recommended bid changes</h2>
        <ul style="padding-left:18px;margin:0;">${bidItems}</ul>`
            : ""
        }

        ${
          pauseItems
            ? `<h2 style="font-size:16px;margin:20px 0 8px;">Campaigns to review</h2>
        <ul style="padding-left:18px;margin:0;">${pauseItems}</ul>`
            : ""
        }

        ${
          structuralItems
            ? `<h2 style="font-size:16px;margin:20px 0 8px;">Structural opportunities</h2>
        <ul style="padding-left:18px;margin:0;">${structuralItems}</ul>`
            : ""
        }

        ${
          dashboardUrl
            ? `<div style="margin:26px 0 6px;">
          <a href="${dashboardUrl}/dashboard" style="background:${YELLOW};color:${INK};text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;display:inline-block;">View full dashboard →</a>
        </div>`
            : ""
        }
      </div>
    </div>
    <div style="text-align:center;color:#9aa6a3;font-size:11px;padding:16px;">
      PHYT App Store Ads · automated daily report
    </div>
  </div>
</body></html>`;

  // Plain-text fallback.
  const text = [
    `PHYT · App Store Ads report — ${dateLabel}`,
    "",
    "PERFORMANCE",
    ...kpis.map(([l, v]) => `  ${l}: ${v}`),
    "",
    `SUMMARY: ${opt.summary}`,
    "",
    opt.bidRecommendations.length ? "BID CHANGES:" : "",
    ...opt.bidRecommendations
      .slice(0, 8)
      .map((b) => `  ${b.keyword}: ${money(b.currentBid, c)} -> ${money(b.proposedBid, c)} (${b.rationale})`),
    "",
    dashboardUrl ? `Dashboard: ${dashboardUrl}/dashboard` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject, html, text };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
