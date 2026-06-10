import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/guard";
import {
  ALL_KEYS,
  CREDENTIAL_GROUPS,
  credentialStatus,
  deleteCredential,
  setCredential,
} from "@/lib/credentials";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  return NextResponse.json({
    groups: CREDENTIAL_GROUPS,
    status: await credentialStatus(),
  });
}

const Body = z.object({
  key: z.string().refine((k) => ALL_KEYS.includes(k), "Unknown key"),
  value: z.string(), // empty string clears the credential
});

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const value = parsed.data.value.trim();
  if (value === "") {
    await deleteCredential(parsed.data.key);
  } else {
    await setCredential(parsed.data.key, value);
  }
  return NextResponse.json({ status: await credentialStatus() });
}
