import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { deleteKpi, listKpis } from "@/lib/repo";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const { id } = await params;
  await deleteKpi(Number(id));
  return NextResponse.json({ kpis: await listKpis() });
}
