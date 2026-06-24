import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/guard";
import { listUsers, updateUser, deleteUser, countAdmins } from "@/lib/repo";

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.enum(["admin", "client"]).optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Don't allow demoting the last admin.
  if (parsed.data.role === "client") {
    const users = await listUsers();
    const target = users.find((u) => u.id === Number(id));
    if (target?.role === "admin" && (await countAdmins()) <= 1) {
      return NextResponse.json(
        { error: "Cannot demote the only admin." },
        { status: 409 },
      );
    }
  }

  await updateUser(Number(id), parsed.data);
  return NextResponse.json({ users: await listUsers() });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const { id } = await params;
  const users = await listUsers();
  const target = users.find((u) => u.id === Number(id));
  if (target?.role === "admin" && (await countAdmins()) <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the only admin." },
      { status: 409 },
    );
  }

  await deleteUser(Number(id));
  return NextResponse.json({ users: await listUsers() });
}
