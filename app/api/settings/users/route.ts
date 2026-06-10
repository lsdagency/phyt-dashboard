import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/guard";
import { listUsers, createUser } from "@/lib/repo";

export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  return NextResponse.json({ users: await listUsers() });
}

const Body = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(["admin", "client"]),
  receivesDailyReport: z.boolean(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }
  try {
    await createUser(parsed.data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create user" },
      { status: 409 },
    );
  }
  return NextResponse.json({ users: await listUsers() });
}
