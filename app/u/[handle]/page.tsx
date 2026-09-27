import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { bottles, profiles } from "@/lib/schema";
import { serializePublicBottle } from "@/lib/serialize";
import { PublicShelf } from "@/components/PublicShelf";

export const dynamic = "force-dynamic";

// Only these statuses ever reach a public shelf; the wishlist stays private.
const PUBLIC_STATUSES = ["owned", "finished"] as const;

/**
 * Look up a shelf by its public handle, the app's third intentional
 * non-user-scoped read (alongside the price-watch cron and `/f/[token]`). Only
 * resolves a profile the user has explicitly made public; anything else is a
 * 404 so a private or unknown handle is indistinguishable.
 */
async function getPublicShelf(handle: string) {
  const slug = handle.trim().toLowerCase();
  if (!slug) return null;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.handle, slug), eq(profiles.isPublic, true)))
    .limit(1);
  if (!profile) return null;

  const rows = await db
    .select()
    .from(bottles)
    .where(and(eq(bottles.userId, profile.userId), inArray(bottles.status, [...PUBLIC_STATUSES])));

  const shelf = rows.map(serializePublicBottle).sort((a, b) => {
    // Owned first, then finished; within each, higher rating, then name.
    if (a.status !== b.status) return a.status === "owned" ? -1 : 1;
    if ((b.rating ?? -1) !== (a.rating ?? -1)) return (b.rating ?? -1) - (a.rating ?? -1);
    return a.name.localeCompare(b.name);
  });

  return { profile, shelf };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const data = await getPublicShelf(handle);
  if (!data) return { title: "Shelf not found | Whiskey Stack" };
  const name = data.profile.displayName || data.profile.handle;
  return {
    title: `${name}'s whisky shelf | Whiskey Stack`,
    description: data.profile.bio ?? `${name}'s whisky collection, shared from Whiskey Stack.`,
  };
}

export default async function PublicShelfPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const data = await getPublicShelf(handle);
  if (!data) notFound();

  const { profile, shelf } = data;
  const name = profile.displayName || profile.handle;
  const countries = new Set(shelf.map((b) => b.country).filter(Boolean)).size;
  const owned = shelf.filter((b) => b.status === "owned").length;
  const finished = shelf.filter((b) => b.status === "finished").length;

  const stats = [
    `${shelf.length} ${shelf.length === 1 ? "bottle" : "bottles"}`,
    countries > 0 ? `${countries} ${countries === 1 ? "country" : "countries"}` : null,
    owned > 0 ? `${owned} owned` : null,
    finished > 0 ? `${finished} finished` : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-5 py-10">
        <p className="text-[11px] uppercase tracking-wide text-cask-200/40">A whisky shelf</p>
        <h1 className="mt-1 font-serif text-4xl text-cask-100">{name}</h1>
        {profile.bio && <p className="mt-2 max-w-prose text-sm text-cask-200/80">{profile.bio}</p>}
        <p className="mt-3 text-sm text-cask-300">{stats.join(" · ")}</p>

        <div className="mt-8">
          <PublicShelf bottles={shelf} />
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
            A read-only view of a personal collection. No prices, notes, or wishlist are shown.
            Please drink responsibly.
          </p>
        </footer>
      </main>
    </div>
  );
}
