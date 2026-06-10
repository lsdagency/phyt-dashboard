import { Resend } from "resend";
import { db, dbAvailable, schema } from "../db";
import { getDashboardData, yesterdayRange } from "../integrations";
import { applyOptimisation, generateOptimisation } from "../optimise";
import { reportRecipients } from "../repo";
import { resolveEnv } from "../credentials";
import { renderDailyReport } from "./render";
import type { DashboardData, Optimisation } from "../integrations/types";

export interface SendResult {
  ok: boolean;
  error?: string;
  sent: number;
  recipients: string[];
  subject?: string;
  generatedBy?: Optimisation["generatedBy"];
  results?: { to: string; ok: boolean; error?: string }[];
}

function dashboardUrl() {
  return (
    process.env.APP_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    ""
  ).replace(/\/$/, "");
}

/**
 * Build yesterday's report (data + Claude optimisation) and send it to the
 * given recipients (or all opted-in client recipients). Logs every send.
 */
export async function buildAndSendDailyReport(opts: {
  to?: string[];
  store?: boolean;
} = {}): Promise<SendResult> {
  const env = await resolveEnv();
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM_EMAIL;

  const recipients =
    opts.to ?? (await reportRecipients()).map((u) => u.email);

  if (!recipients.length) {
    return { ok: false, error: "No recipients configured", sent: 0, recipients: [] };
  }

  // Build the report payload with Claude's optimisation applied.
  const range = yesterdayRange(process.env.APP_TIMEZONE || "Europe/London");
  const data: DashboardData = await getDashboardData(range, { refresh: true });
  const optimisation = await generateOptimisation(data, env);
  applyOptimisation(data, optimisation);

  if (opts.store && dbAvailable && db) {
    await db.insert(schema.optimisations).values({
      forDate: range.end,
      recommendations: optimisation,
      summary: optimisation.summary,
      status: "sent",
      model: optimisation.model ?? optimisation.generatedBy,
    });
  }

  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Resend is not configured (add API key + from address in Settings).",
      sent: 0,
      recipients,
      generatedBy: optimisation.generatedBy,
    };
  }

  const { subject, html, text } = renderDailyReport(data, optimisation, dashboardUrl());
  const resend = new Resend(apiKey);

  let sent = 0;
  const results: { to: string; ok: boolean; error?: string }[] = [];
  for (const to of recipients) {
    try {
      const { error } = await resend.emails.send({ from, to, subject, html, text });
      if (error) throw new Error(error.message);
      sent++;
      results.push({ to, ok: true });
      if (dbAvailable && db) {
        await db.insert(schema.emailLog).values({ recipient: to, subject, status: "sent" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "send failed";
      results.push({ to, ok: false, error: msg });
      if (dbAvailable && db) {
        await db.insert(schema.emailLog).values({ recipient: to, subject, status: "failed", error: msg });
      }
    }
  }

  return {
    ok: sent > 0,
    sent,
    recipients,
    subject,
    generatedBy: optimisation.generatedBy,
    results,
  };
}
