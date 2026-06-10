import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/guard";
import { listKpis, upsertKpi } from "@/lib/repo";

export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  return NextResponse.json({ kpis: await listKpis() });
}

const Body = z.object({
  metric: z.string().min(1).max(64),
  target: z.number().finite(),
  direction: z.enum(["up", "down"]),
});

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  await upsertKpi(parsed.data);
  return NextResponse.json({ kpis: await listKpis() });
}
