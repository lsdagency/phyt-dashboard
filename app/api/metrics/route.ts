import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDashboardData, parseRange } from "@/lib/integrations";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // first load of the day may generate the Claude optimisation

/** Normalised metrics for the dashboard. Any signed-in user (admin or client). */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = parseRange(searchParams.get("start"), searchParams.get("end"));
  const refresh = searchParams.get("refresh") === "1";

  const data = await getDashboardData(range, { refresh });
  return NextResponse.json(data);
}
