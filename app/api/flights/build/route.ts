import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles } from "@/lib/schema";
import { buildTastingFlight, AiNotConfiguredError } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const theme: string | undefined =
    typeof body?.theme === "string" && body.theme.trim() ? body.theme.trim() : undefined;
  const count: number | undefined =
    typeof body?.count === "number" && Number.isFinite(body.count) ? body.count : undefined;

  const rows = await db.select().from(bottles).where(eq(bottles.userId, user.id));
  const owned = rows.filter((b) => b.status !== "wishlist");
  if (owned.length < 2) {
    return NextResponse.json(
      { error: "Add at least two owned bottles to your collection first." },
      { status: 400 },
    );
  }

  try {
    const result = await buildTastingFlight({ bottles: rows, theme, count });
    // Map 1-based indices from the numbered owned list back to bottleIds; drop
    // any out-of-range index and de-dupe so the draft is always valid.
    const seen = new Set<string>();
    const items: { bottleId: string; note: string | null }[] = [];
    for (const step of result.steps) {
      const b = owned[step.index - 1];
      if (!b || seen.has(b.id)) continue;
      seen.add(b.id);
      items.push({ bottleId: b.id, note: step.note?.trim() ? step.note.trim() : null });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "The AI couldn't build a flight. Try again." }, { status: 502 });
    }
    // An UNSAVED draft: the client pre-fills the builder and the user saves it.
    return NextResponse.json({ title: result.title, theme: result.theme, items });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("flight build error:", err);
    return NextResponse.json({ error: "Could not build a flight. Try again." }, { status: 502 });
  }
}
