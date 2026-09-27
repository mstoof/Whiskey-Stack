import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { desc, eq, and, inArray } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles, flights } from "@/lib/schema";
import type { Bottle } from "@/lib/schema";
import { serializeFlight } from "@/lib/serialize";
import { flightInputSchema, type FlightInput, type FlightItemSnapshot } from "@/lib/types";

/**
 * Rebuild the trusted ordered snapshots for a flight from the owner's own
 * bottles. `ownedById` MUST contain only bottles owned by the current user;
 * any item whose bottleId isn't in the map is an ownership violation.
 * Throws an Error (message → 400) if an item references a bottle they don't own.
 */
export function buildFlightItems(
  items: FlightInput["items"],
  ownedById: Map<string, Bottle>,
): FlightItemSnapshot[] {
  return items.map((item) => {
    const b = ownedById.get(item.bottleId);
    if (!b) throw new Error("That bottle isn't in your collection.");
    return {
      bottleId: b.id,
      name: b.name,
      category: b.category,
      country: b.country,
      region: b.region,
      abv: b.abv != null ? Number(b.abv) : null,
      ageStatement: b.ageStatement ?? null,
      note: item.note?.trim() ? item.note.trim() : null,
    };
  });
}

export async function GET() {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(flights)
    .where(eq(flights.userId, user.id))
    .orderBy(desc(flights.createdAt));

  return NextResponse.json(rows.map(serializeFlight));
}

export async function POST(req: Request) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = flightInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const input = parsed.data;

  // Load only the referenced bottles that this user actually owns.
  const ids = [...new Set(input.items.map((i) => i.bottleId))];
  const owned = await db
    .select()
    .from(bottles)
    .where(and(eq(bottles.userId, user.id), inArray(bottles.id, ids)));
  const ownedById = new Map(owned.map((b) => [b.id, b]));

  let items: FlightItemSnapshot[];
  try {
    items = buildFlightItems(input.items, ownedById);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid bottles." },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(flights)
    .values({
      userId: user.id,
      title: input.title,
      theme: input.theme?.trim() ? input.theme.trim() : null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      items,
      shareToken: input.shared ? randomUUID() : null,
    })
    .returning();

  return NextResponse.json(serializeFlight(row), { status: 201 });
}
