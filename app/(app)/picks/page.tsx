import { desc, eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { savedRecommendations } from "@/lib/schema";
import { serializeSavedRecommendation } from "@/lib/serialize";
import { PicksView } from "@/components/PicksView";

export const dynamic = "force-dynamic";

export default async function PicksPage() {
  const user = await stackServerApp.getUser({ or: "redirect" });

  const rows = await db
    .select()
    .from(savedRecommendations)
    .where(eq(savedRecommendations.userId, user.id))
    .orderBy(desc(savedRecommendations.createdAt));

  return <PicksView recs={rows.map(serializeSavedRecommendation)} />;
}
