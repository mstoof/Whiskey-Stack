import { and, desc, eq, isNotNull } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles } from "@/lib/schema";
import { serializeBottle } from "@/lib/serialize";
import { WatchlistView } from "@/components/WatchlistView";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const user = await stackServerApp.getUser({ or: "redirect" });

  const rows = await db
    .select()
    .from(bottles)
    .where(
      and(
        eq(bottles.userId, user.id),
        eq(bottles.status, "wishlist"),
        isNotNull(bottles.targetPriceEur),
      ),
    )
    .orderBy(desc(bottles.createdAt));

  return <WatchlistView bottles={rows.map(serializeBottle)} />;
}
