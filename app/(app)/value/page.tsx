import { asc, eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { valueSnapshots } from "@/lib/schema";
import { serializeValueSnapshot } from "@/lib/serialize";
import { ValueView } from "@/components/ValueView";

export const dynamic = "force-dynamic";

export default async function ValuePage() {
  const user = await stackServerApp.getUser({ or: "redirect" });

  const rows = await db
    .select()
    .from(valueSnapshots)
    .where(eq(valueSnapshots.userId, user.id))
    .orderBy(asc(valueSnapshots.date));

  return <ValueView snapshots={rows.map(serializeValueSnapshot)} />;
}
