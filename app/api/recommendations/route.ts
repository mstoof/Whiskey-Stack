import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { savedRecommendations } from "@/lib/schema";
import { serializeSavedRecommendation } from "@/lib/serialize";
import { recommendationSchema } from "@/lib/types";

export async function GET() {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(savedRecommendations)
    .where(eq(savedRecommendations.userId, user.id))
    .orderBy(desc(savedRecommendations.createdAt));

  return NextResponse.json(rows.map(serializeSavedRecommendation));
}

/**
 * Save one AI recommendation the user chose to keep. The client sends back the
 * exact `Recommendation` object it already has (from a discovery or
 * complete-the-set run), re-validated here, never trusted as-is.
 */
export async function POST(req: Request) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = recommendationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const r = parsed.data;

  const [row] = await db
    .insert(savedRecommendations)
    .values({
      userId: user.id,
      name: r.name,
      distillery: r.distillery ?? null,
      category: r.category ?? null,
      country: r.country ?? null,
      flavorProfile: r.flavorProfile,
      reasoning: r.reasoning,
      estPriceEur: r.estPriceEur != null ? String(r.estPriceEur) : null,
      retailer: r.retailer ?? null,
      productUrl: r.productUrl ?? null,
    })
    .returning();

  return NextResponse.json(serializeSavedRecommendation(row), { status: 201 });
}
