import { NextResponse } from "next/server";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles, valueSnapshots } from "@/lib/schema";
import { findCheapestOffers, GeminiNotConfiguredError } from "@/lib/gemini";
import { purchasableOffers } from "@/lib/prices";
import { isRateLimited } from "@/lib/aiShared";
import { sendPriceDropEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * How many watched bottles to re-price per run. Grounded Gemini calls burn
 * quota fast, so we cap each run and pick the least-recently-checked first.
 * Every watched bottle gets covered over successive daily runs, and we stop
 * early on a rate-limit rather than blowing the whole quota.
 *
 * This route deliberately calls Gemini directly (`@/lib/gemini`), not the
 * `@/lib/ai` fallback router other AI routes use. That "stop early" behavior
 * exists specifically to preserve Gemini's quota across days, and OpenRouter's
 * free tier is much smaller (tens of requests/day). Burning it here would
 * starve the interactive fallback (Discover/Complete/Vision/Flight-build) for
 * no real benefit: a skipped bottle just gets retried tomorrow either way.
 */
const MAX_PER_RUN = 15;

/**
 * Daily Vercel Cron entry point (configured in vercel.json). Re-prices watched
 * wishlist bottles across ALL users, the one intentional non-user-scoped query
 * in the app, and flags/records drops. The response is counts only; no
 * per-user bottle data ever leaves this route.
 */
export async function GET(req: Request) {
  // Fail closed if the deployment is missing the cron secret. A public cron
  // endpoint could trigger expensive AI calls and send unwanted mail.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Cron endpoint is not configured." }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const watched = await db
    .select()
    .from(bottles)
    .where(and(eq(bottles.status, "wishlist"), isNotNull(bottles.targetPriceEur)))
    .orderBy(sql`${bottles.lastCheckedAt} asc nulls first`, asc(bottles.createdAt))
    .limit(MAX_PER_RUN);

  let checked = 0;
  let drops = 0;
  let emailed = 0;
  let errors = 0;
  let stoppedEarly = false;

  for (const b of watched) {
    const target = b.targetPriceEur != null ? Number(b.targetPriceEur) : null;
    if (target == null) continue;

    try {
      const offers = purchasableOffers(await findCheapestOffers(b.name));
      const cheapest = offers[0]; // findCheapestOffers sorts cheapest-first
      checked++;

      const now = new Date();
      const price = cheapest?.priceEur ?? null;

      const update: Partial<typeof bottles.$inferInsert> = {
        lastCheckedPriceEur: price != null ? String(price) : null,
        lastCheckedRetailer: cheapest?.retailer ?? null,
        lastCheckedUrl: cheapest?.productUrl ?? null,
        lastCheckedAt: now,
      };

      if (price != null && price <= target) {
        // A drop. Notify once per drop episode (lastNotifiedAt gates repeats).
        if (b.lastNotifiedAt == null) {
          drops++;
          update.lastNotifiedAt = now;
          const owner = await stackServerApp.getUser(b.userId).catch(() => null);
          if (owner?.primaryEmail) {
            const sent = await sendPriceDropEmail({
              to: owner.primaryEmail,
              bottleName: b.name,
              priceEur: price,
              targetEur: target,
              retailer: cheapest?.retailer,
              url: cheapest?.productUrl,
            });
            if (sent) emailed++;
          }
        }
      } else {
        // Above target (or no price): reset so the next real drop notifies again.
        update.lastNotifiedAt = null;
      }

      await db.update(bottles).set(update).where(eq(bottles.id, b.id));
    } catch (err) {
      if (err instanceof GeminiNotConfiguredError || isRateLimited(err)) {
        stoppedEarly = true;
        break; // preserve quota; remaining bottles get picked up next run
      }
      errors++;
      console.error(`price-watch: failed for ${b.id}:`, err);
    }
  }

  const snapshotted = await snapshotCollectionValues();

  return NextResponse.json({ checked, drops, emailed, errors, stoppedEarly, snapshotted });
}

/**
 * Aggregate + upsert today's collection-value snapshot for every user who owns
 * at least one bottle. Pure SQL aggregates, no Gemini calls, so this runs
 * unconditionally (even with no GEMINI_API_KEY, and even after `stoppedEarly`
 * above) and gives every deployment a value trend from day one. The one
 * intentional non-user-scoped query in this route, alongside the pricing loop.
 */
async function snapshotCollectionValues(): Promise<number> {
  const perUser = await db
    .select({
      userId: bottles.userId,
      ownedCount: sql<number>`count(*) filter (where ${bottles.status} = 'owned')::int`,
      purchaseValueEur: sql<string>`coalesce(sum(${bottles.purchasePriceEur}) filter (where ${bottles.status} = 'owned'), 0)`,
      marketValueEur: sql<string | null>`sum(${bottles.lastCheckedPriceEur}) filter (where ${bottles.status} = 'wishlist' and ${bottles.targetPriceEur} is not null and ${bottles.lastCheckedPriceEur} is not null)`,
    })
    .from(bottles)
    .groupBy(bottles.userId);

  const today = new Date().toISOString().slice(0, 10); // UTC calendar day
  let snapshotted = 0;

  for (const row of perUser) {
    if (row.ownedCount === 0) continue; // nothing owned yet, no collection to value

    await db
      .insert(valueSnapshots)
      .values({
        userId: row.userId,
        date: today,
        purchaseValueEur: row.purchaseValueEur,
        ownedCount: row.ownedCount,
        marketValueEur: row.marketValueEur,
      })
      .onConflictDoUpdate({
        target: [valueSnapshots.userId, valueSnapshots.date],
        set: {
          purchaseValueEur: row.purchaseValueEur,
          ownedCount: row.ownedCount,
          marketValueEur: row.marketValueEur,
        },
      });
    snapshotted++;
  }

  return snapshotted;
}
