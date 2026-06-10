import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { getDashboardData, yesterdayRange } from "@/lib/integrations";
import { applyOptimisation, generateOptimisation } from "@/lib/optimise";
import { resolveEnv } from "@/lib/credentials";
import { renderDailyReport } from "@/lib/email/render";

export const dynamic = "force-dynamic";

/** Renders the daily email as HTML for in-browser preview (no send). Admin only. */
export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const env = await resolveEnv();
  const range = yesterdayRange(process.env.APP_TIMEZONE || "Europe/London");
  const data = await getDashboardData(range, {});
  const optimisation = await generateOptimisation(data, env);
  applyOptimisation(data, optimisation);

  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/$/, "");
  const { html } = renderDailyReport(data, optimisation, base);

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
