import { NextResponse } from "next/server";
import { buildAndSendDailyReport } from "@/lib/email/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily report cron. Called by the Netlify scheduled function with the
 * x-cron-secret header. Sends to all opted-in client recipients.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await buildAndSendDailyReport({ store: true });
  return NextResponse.json(result);
}
