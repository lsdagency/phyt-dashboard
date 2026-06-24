import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { getDashboardData, parseRange } from "@/lib/integrations";
import { db, dbAvailable, schema } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Recalculate (and store) the rules-based optimisation from fresh data. Admin only. */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const { searchParams } = new URL(req.url);
  const range = parseRange(searchParams.get("start"), searchParams.get("end"));

  // refresh re-pulls source data; the optimisation is recomputed from it.
  const data = await getDashboardData(range, { refresh: true });
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
