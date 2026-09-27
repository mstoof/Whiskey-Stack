import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { savedRecommendations } from "@/lib/schema";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [row] = await db
    .delete(savedRecommendations)
    .where(and(eq(savedRecommendations.id, id), eq(savedRecommendations.userId, user.id)))
    .returning({ id: savedRecommendations.id });

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
