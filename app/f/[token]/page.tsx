import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { flights } from "@/lib/schema";
import { FlightLineup } from "@/components/FlightLineup";

export const dynamic = "force-dynamic";

/** Look up a public flight by its share token, or null. */
async function getSharedFlight(token: string) {
  if (!token) return null;
  const [row] = await db.select().from(flights).where(eq(flights.shareToken, token)).limit(1);
  return row ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const flight = await getSharedFlight(token);
  if (!flight) return { title: "Flight not found | Whiskey Stack" };
  return {
    title: `${flight.title}: a tasting flight`,
    description: flight.theme ?? "A whisky tasting flight shared from Whiskey Stack.",
  };
}

export default async function SharedFlightPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const flight = await getSharedFlight(token);
  if (!flight) notFound();

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-2xl px-5 py-10">
        <p className="text-[11px] uppercase tracking-wide text-cask-200/40">A tasting flight</p>
        <h1 className="mt-1 font-serif text-4xl text-cask-100">{flight.title}</h1>
        {flight.theme && <p className="mt-1 text-cask-300">{flight.theme}</p>}
        {flight.notes && <p className="mt-4 max-w-prose text-sm text-cask-200/80">{flight.notes}</p>}

        <div className="mt-8">
          <FlightLineup items={flight.items} />
        </div>

        <footer className="mt-12 border-t border-cask-900/70 pt-6 text-xs text-cask-200/40">
          <p>
            Shared from{" "}
            <Link href="/" className="text-cask-300 hover:text-cask-100">
              🥃 Whiskey Stack
            </Link>
            .
          </p>
          <p className="mt-2">
            Prices and availability elsewhere in the app are AI estimates. Always verify at the store.
            This is a personal tasting lineup; please drink responsibly.
          </p>
        </footer>
      </main>
    </div>
  );
}
