import { desc, eq, and } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles } from "@/lib/schema";
import { serializeBottle } from "@/lib/serialize";
import { WishlistView } from "@/components/WishlistView";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const user = await stackServerApp.getUser({ or: "redirect" });

  const rows = await db
    .select()
    .from(bottles)
    .where(and(eq(bottles.userId, user.id), eq(bottles.status, "wishlist")))
    .orderBy(desc(bottles.createdAt));

  return <WishlistView initialBottles={rows.map(serializeBottle)} />;
}
