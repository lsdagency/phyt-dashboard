import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/guard";
import { buildAndSendDailyReport } from "@/lib/email/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ to: z.string().email().optional() });

/** Send a test daily report to the given address (or the admin). Admin only. */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const to = parsed.success && parsed.data.to ? [parsed.data.to] : [gate.session.email];

  const result = await buildAndSendDailyReport({ to });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
