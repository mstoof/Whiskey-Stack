import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles } from "@/lib/schema";
import { serializeBottle } from "@/lib/serialize";
import { bottleInputSchema } from "@/lib/types";
import { toInsertValues } from "../route";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = bottleInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const [row] = await db
    .update(bottles)
    .set({ ...toInsertValues(parsed.data), updatedAt: new Date() })
    .where(and(eq(bottles.id, id), eq(bottles.userId, user.id)))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeBottle(row));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [row] = await db
    .delete(bottles)
    .where(and(eq(bottles.id, id), eq(bottles.userId, user.id)))
    .returning({ id: bottles.id });

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
