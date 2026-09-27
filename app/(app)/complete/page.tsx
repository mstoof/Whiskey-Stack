import { eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles } from "@/lib/schema";
import { isAiConfigured } from "@/lib/ai";
import { CompletePanel } from "@/components/CompletePanel";

export const dynamic = "force-dynamic";

export default async function CompletePage() {
  const user = await stackServerApp.getUser({ or: "redirect" });
  const aiEnabled = isAiConfigured();

  const rows = await db.select().from(bottles).where(eq(bottles.userId, user.id));
  const distilleries = [
    ...new Set(rows.map((b) => b.distillery).filter((v): v is string => Boolean(v))),
  ].sort();
  const regions = [
    ...new Set(rows.map((b) => b.region).filter((v): v is string => Boolean(v))),
  ].sort();

  return <CompletePanel aiEnabled={aiEnabled} distilleries={distilleries} regions={regions} />;
}
