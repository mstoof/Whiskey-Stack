import { NextResponse } from "next/server";
import { stackServerApp } from "@/stack";
import { findCheapestOffers, AiNotConfiguredError } from "@/lib/ai";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bottles } from "@/lib/schema";
import { purchasableOffers } from "@/lib/prices";
import { z } from "zod";

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name: string | undefined = typeof body?.name === "string" ? body.name.trim() : undefined;
  if (!name) return NextResponse.json({ error: "Bottle name is required." }, { status: 400 });

  let bottleId: string | undefined;
  if (body.bottleId != null) {
    const parsedId = z.string().uuid().safeParse(body.bottleId);
    if (!parsedId.success) return NextResponse.json({ error: "Invalid bottle ID." }, { status: 400 });
    bottleId = parsedId.data;
    const [bottle] = await db.select({ name: bottles.name }).from(bottles)
      .where(and(eq(bottles.id, bottleId), eq(bottles.userId, user.id)));
    if (!bottle) return NextResponse.json({ error: "Bottle not found." }, { status: 404 });
    if (bottle.name !== name) return NextResponse.json({ error: "Bottle details changed. Refresh and try again." }, { status: 409 });
  }

  try {
    const offers = purchasableOffers(await findCheapestOffers(name));
    const checkedAt = new Date();
    const cheapest = offers[0];
    if (bottleId) {
      await db.update(bottles).set({
        lastCheckedPriceEur: cheapest ? String(cheapest.priceEur) : null,
        lastCheckedRetailer: cheapest?.retailer ?? null,
        lastCheckedUrl: cheapest?.productUrl ?? null,
        lastCheckedAt: checkedAt,
      }).where(and(eq(bottles.id, bottleId), eq(bottles.userId, user.id), eq(bottles.name, name)));
    }
    return NextResponse.json({ offers, checkedAt: checkedAt.toISOString() });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("price error:", err);
    return NextResponse.json({ error: "Price lookup failed. Try again." }, { status: 502 });
  }
}
