import { desc, eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles } from "@/lib/schema";
import { serializeBottle } from "@/lib/serialize";
import { InsightsView } from "@/components/InsightsView";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const user = await stackServerApp.getUser({ or: "redirect" });

  const rows = await db
    .select()
    .from(bottles)
    .where(eq(bottles.userId, user.id))
    .orderBy(desc(bottles.createdAt));

  return <InsightsView bottles={rows.map(serializeBottle)} />;
}
