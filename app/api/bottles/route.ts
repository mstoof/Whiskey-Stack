import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles } from "@/lib/schema";
import { serializeBottle } from "@/lib/serialize";
import { bottleInputSchema, type BottleInput } from "@/lib/types";

/** Map validated input to DB values (numeric columns want strings). */
export function toInsertValues(input: BottleInput) {
  return {
    name: input.name,
    distillery: input.distillery ?? null,
    country: input.country ?? null,
    region: input.region ?? null,
    category: input.category ?? null,
    ageStatement: input.ageStatement ?? null,
    abv: input.abv != null ? String(input.abv) : null,
    status: input.status,
    rating: input.rating ?? null,
    purchasePriceEur: input.purchasePriceEur != null ? String(input.purchasePriceEur) : null,
    purchaseStore: input.purchaseStore ?? null,
    targetPriceEur: input.targetPriceEur != null ? String(input.targetPriceEur) : null,
    flavorTags: input.flavorTags ?? [],
    notes: input.notes ?? null,
    imageUrl: input.imageUrl && input.imageUrl !== "" ? input.imageUrl : null,
    descriptionEn: input.descriptionEn ?? null,
    descriptionNl: input.descriptionNl ?? null,
  };
}

export async function GET() {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(bottles)
    .where(eq(bottles.userId, user.id))
    .orderBy(desc(bottles.createdAt));

  return NextResponse.json(rows.map(serializeBottle));
}

export async function POST(req: Request) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bottleInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const [row] = await db
    .insert(bottles)
    .values({ userId: user.id, ...toInsertValues(parsed.data) })
    .returning();

  return NextResponse.json(serializeBottle(row), { status: 201 });
}
