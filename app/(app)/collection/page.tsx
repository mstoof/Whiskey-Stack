import { and, desc, eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles } from "@/lib/schema";
import { serializeBottle } from "@/lib/serialize";
import { CollectionView } from "@/components/CollectionView";

export const dynamic = "force-dynamic";

export default async function CollectionPage() {
  const user = await stackServerApp.getUser({ or: "redirect" });

  const rows = await db
    .select()
    .from(bottles)
    .where(and(eq(bottles.userId, user.id), eq(bottles.status, "owned")))
    .orderBy(desc(bottles.createdAt));

  return <CollectionView initialBottles={rows.map(serializeBottle)} />;
}
