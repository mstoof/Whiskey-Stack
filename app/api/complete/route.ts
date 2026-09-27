import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles } from "@/lib/schema";
import { serializeBottle } from "@/lib/serialize";
import { completeTheSet, AiNotConfiguredError } from "@/lib/ai";

export const maxDuration = 60; // grounded search can take a while

export async function POST(req: Request) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const target: string = typeof body?.target === "string" ? body.target.trim() : "";
  const targetType: "distillery" | "region" = body?.targetType === "region" ? "region" : "distillery";
  if (!target) {
    return NextResponse.json({ error: "Pick a distillery or region." }, { status: 400 });
  }

  const rows = await db.select().from(bottles).where(eq(bottles.userId, user.id));

  // Which of their bottles already belong to this set?
  const t = target.toLowerCase();
  const ownedInSet = rows.filter((b) => {
    if (targetType === "region") return b.region?.toLowerCase().includes(t) ?? false;
    return (
      (b.distillery?.toLowerCase().includes(t) ?? false) ||
      b.name.toLowerCase().includes(t)
    );
  });

  try {
    const recommendations = await completeTheSet({
      target,
      targetType,
      owned: ownedInSet.map((b) => b.name),
    });
    return NextResponse.json({
      owned: ownedInSet.map(serializeBottle),
      recommendations,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("complete error:", err);
    return NextResponse.json({ error: "Could not build the set. Try again." }, { status: 502 });
  }
}
