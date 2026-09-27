import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles, flights } from "@/lib/schema";
import { serializeFlight } from "@/lib/serialize";
import { flightInputSchema, type FlightItemSnapshot } from "@/lib/types";
import { buildFlightItems } from "../route";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = flightInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const input = parsed.data;

  // Confirm ownership of the flight first (also gives us its current shareToken).
  const [existing] = await db
    .select()
    .from(flights)
    .where(and(eq(flights.id, id), eq(flights.userId, user.id)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  // Re-sharing after unsharing mints a fresh token; keep the existing one while shared.
  const shareToken = input.shared ? existing.shareToken ?? randomUUID() : null;

  const [row] = await db
    .update(flights)
    .set({
      title: input.title,
      theme: input.theme?.trim() ? input.theme.trim() : null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      items,
      shareToken,
      updatedAt: new Date(),
    })
    .where(and(eq(flights.id, id), eq(flights.userId, user.id)))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeFlight(row));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [row] = await db
    .delete(flights)
    .where(and(eq(flights.id, id), eq(flights.userId, user.id)))
    .returning({ id: flights.id });

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
