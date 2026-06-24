import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { getDashboardData, parseRange } from "@/lib/integrations";
import { db, dbAvailable, schema } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Claude call can take a few seconds

/** Force-regenerate (and store) the optimisation with Claude. Admin only. */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const { searchParams } = new URL(req.url);
  const range = parseRange(searchParams.get("start"), searchParams.get("end"));

  // refresh re-pulls source data; regenerate forces a fresh Claude call + re-cache.
  const data = await getDashboardData(range, { refresh: true, regenerate: true });
  const optimisation = data.optimisation;

  if (dbAvailable && db) {
    await db.insert(schema.optimisations).values({
      forDate: range.end,
      recommendations: optimisation,
      summary: optimisation.summary,
      status: "draft",
      model: optimisation.model ?? optimisation.generatedBy,
    });
  }

  return NextResponse.json({ optimisation });
}
