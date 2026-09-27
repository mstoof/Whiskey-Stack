import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles } from "@/lib/schema";
import { discoverWhiskeys, AiNotConfiguredError } from "@/lib/ai";

export const maxDuration = 60; // grounded search can take a while

export async function POST(req: Request) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const preferences: string | undefined =
    typeof body?.preferences === "string" ? body.preferences : undefined;

  const rows = await db.select().from(bottles).where(eq(bottles.userId, user.id));

  try {
    const recommendations = await discoverWhiskeys({ bottles: rows, preferences });
    return NextResponse.json({ recommendations });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("discover error:", err);
    return NextResponse.json({ error: "Discovery failed. Try again." }, { status: 502 });
  }
}
