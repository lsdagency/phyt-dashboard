import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAdmin } from "@/lib/guard";
import { resolveEnv } from "@/lib/credentials";
import { getCompetitorReport } from "@/lib/integrations/competitors";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // first build fetches ~9 apps + Claude analysis

/** Cached weekly competitor report. Any signed-in user. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const report = await getCompetitorReport(await resolveEnv());
  return NextResponse.json(report);
}

/** Force a fresh competitor report (re-fetch + re-analyse). Admin only. */
export async function POST() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const report = await getCompetitorReport(await resolveEnv(), { refresh: true });
  return NextResponse.json(report);
}
