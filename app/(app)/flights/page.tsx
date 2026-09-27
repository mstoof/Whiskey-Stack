import { desc, eq } from "drizzle-orm";
import { stackServerApp } from "@/stack";
import { db } from "@/lib/db";
import { bottles, flights } from "@/lib/schema";
import { serializeBottle, serializeFlight } from "@/lib/serialize";
import { isAiConfigured } from "@/lib/ai";
import { FlightsView } from "@/components/FlightsView";

export const dynamic = "force-dynamic";

export default async function FlightsPage() {
  const user = await stackServerApp.getUser({ or: "redirect" });
  const aiEnabled = isAiConfigured();

  const [flightRows, bottleRows] = await Promise.all([
    db.select().from(flights).where(eq(flights.userId, user.id)).orderBy(desc(flights.createdAt)),
    db.select().from(bottles).where(eq(bottles.userId, user.id)).orderBy(desc(bottles.createdAt)),
  ]);

  // Only non-wishlist bottles are pourable; that's the flight-building shelf.
  const pourable = bottleRows.filter((b) => b.status !== "wishlist");

  return (
    <FlightsView
      initialFlights={flightRows.map(serializeFlight)}
      bottles={pourable.map(serializeBottle)}
      aiEnabled={aiEnabled}
    />
  );
}
