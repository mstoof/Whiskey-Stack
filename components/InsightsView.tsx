"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { BottleDTO } from "@/lib/serialize";
import { CATEGORIES } from "@/lib/types";

/** Short labels so the radar axes stay readable. */
const CATEGORY_SHORT: Record<string, string> = {
  "single malt scotch": "Single malt",
  "blended scotch": "Blended",
  bourbon: "Bourbon",
  rye: "Rye",
  irish: "Irish",
  japanese: "Japanese",
  "world whisky": "World",
  other: "Other",
};

function countBy(values: (string | null | undefined)[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of values) {
    const key = v?.trim();
    if (!key) continue;
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return m;
}

function sortedEntries(m: Map<string, number>): [string, number][] {
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/** A labelled horizontal bar list, capped at `limit` rows. */
function BarList({
  title,
  entries,
  empty,
  limit = 8,
}: {
  title: string;
  entries: [string, number][];
  empty: string;
  limit?: number;
}) {
  const rows = entries.slice(0, limit);
  const max = rows.reduce((m, [, n]) => Math.max(m, n), 0) || 1;
  return (
    <div className="rounded-2xl border border-cask-800/70 bg-night-900/60 p-5">
      <h2 className="font-serif text-lg text-cask-100">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-cask-200/50">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map(([label, n]) => (
            <li key={label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate capitalize text-cask-100">{label}</span>
                <span className="shrink-0 tabular-nums text-cask-200/50">{n}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-night-950">
                <div
                  className="h-full rounded-full bg-cask-500/70"
                  style={{ width: `${Math.round((n / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Pure-SVG radar of how many bottles fall in each category. */
function CategoryRadar({ counts }: { counts: Map<string, number> }) {
  const size = 320;
  const c = size / 2;
  const R = 120;
  const axes = CATEGORIES;
  const n = axes.length;
  const max = Math.max(1, ...axes.map((cat) => counts.get(cat) ?? 0));
  const rings = [0.25, 0.5, 0.75, 1];

  const point = (i: number, radiusFactor: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      x: c + R * radiusFactor * Math.cos(angle),
      y: c + R * radiusFactor * Math.sin(angle),
      angle,
    };
  };

  const polygon = axes
    .map((cat, i) => {
      const v = (counts.get(cat) ?? 0) / max;
      const p = point(i, v);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="rounded-2xl border border-cask-800/70 bg-night-900/60 p-5">
      <h2 className="font-serif text-lg text-cask-100">Category spread</h2>
      <p className="mt-1 text-sm text-cask-200/50">
        The shape of your shelf across whisky styles. A dent is a style to explore.
      </p>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto mt-3 h-auto w-full max-w-[360px]"
        role="img"
        aria-label="Radar chart of bottle counts per whisky category"
      >
        {/* grid rings */}
        {rings.map((rf) => (
          <polygon
            key={rf}
            points={axes
              .map((_, i) => {
                const p = point(i, rf);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              })
              .join(" ")}
            fill="none"
            stroke="currentColor"
            className="text-cask-800/50"
            strokeWidth={1}
          />
        ))}
        {/* spokes + labels */}
        {axes.map((cat, i) => {
          const edge = point(i, 1);
          const label = point(i, 1.16);
          const anchor =
            Math.abs(label.x - c) < 8 ? "middle" : label.x > c ? "start" : "end";
          return (
            <g key={cat}>
              <line
                x1={c}
                y1={c}
                x2={edge.x}
                y2={edge.y}
                stroke="currentColor"
                className="text-cask-800/40"
                strokeWidth={1}
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                className="fill-cask-200/70 text-[10px]"
              >
                {CATEGORY_SHORT[cat] ?? cat}
              </text>
            </g>
          );
        })}
        {/* data polygon */}
        <polygon
          points={polygon}
          className="fill-cask-500/25 stroke-cask-400"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {axes.map((cat, i) => {
          const v = (counts.get(cat) ?? 0) / max;
          const p = point(i, v);
          return <circle key={cat} cx={p.x} cy={p.y} r={2.5} className="fill-cask-300" />;
        })}
      </svg>
    </div>
  );
}

export function InsightsView({ bottles }: { bottles: BottleDTO[] }) {
  const data = useMemo(() => {
    const owned = bottles.filter((b) => b.status === "owned");
    const finished = bottles.filter((b) => b.status === "finished");
    const wishlist = bottles.filter((b) => b.status === "wishlist");
    // The "collection" for breadth = things you have or have had, not aspirational wishlist.
    const acquired = bottles.filter((b) => b.status !== "wishlist");

    const categoryCounts = countBy(acquired.map((b) => b.category));
    const missingCategories = CATEGORIES.filter((c) => !categoryCounts.get(c));

    const shelfValue = owned.reduce((s, b) => s + (b.purchasePriceEur ?? 0), 0);
    const ratedOwned = acquired.filter((b) => b.rating != null);
    const avgRating = ratedOwned.length
      ? Math.round(ratedOwned.reduce((s, b) => s + (b.rating ?? 0), 0) / ratedOwned.length)
      : null;

    return {
      totals: {
        total: bottles.length,
        owned: owned.length,
        finished: finished.length,
        wishlist: wishlist.length,
      },
      shelfValue,
      avgRating,
      categoryCounts,
      missingCategories,
      countries: sortedEntries(countBy(acquired.map((b) => b.country))),
      regions: sortedEntries(countBy(acquired.map((b) => b.region))),
      flavours: sortedEntries(countBy(acquired.flatMap((b) => b.flavorTags ?? []))),
      distilleries: sortedEntries(countBy(acquired.map((b) => b.distillery))),
    };
  }, [bottles]);

  if (bottles.length === 0) {
    return (
      <div>
        <h1 className="font-serif text-3xl text-cask-100">Insights</h1>
        <div className="mt-16 rounded-2xl border border-dashed border-cask-800/60 p-12 text-center">
          <p className="text-cask-200/60">
            Add a few bottles and your collection insights will appear here.
          </p>
          <Link
            href="/collection"
            className="mt-4 inline-block rounded-lg bg-cask-500 px-4 py-2 text-sm font-semibold text-night-950 hover:bg-cask-400"
          >
            Go to your collection
          </Link>
        </div>
      </div>
    );
  }

  const stat = (label: string, value: string) => (
    <div className="rounded-xl border border-cask-800/70 bg-night-900/60 px-4 py-3">
      <div className="text-2xl font-semibold text-cask-100 tabular-nums">{value}</div>
      <div className="text-xs uppercase tracking-wide text-cask-200/50">{label}</div>
    </div>
  );

  return (
    <div>
      <div>
        <h1 className="font-serif text-3xl text-cask-100">Insights</h1>
        <p className="mt-1 text-sm text-cask-200/60">
          What your shelf looks like by style, origin and flavour, and where the gaps are.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stat("On the shelf", String(data.totals.owned))}
        {stat("Finished", String(data.totals.finished))}
        {stat("Wishlist", String(data.totals.wishlist))}
        {stat("Countries", String(data.countries.length))}
        {stat(
          "Shelf value",
          data.shelfValue > 0
            ? `€${data.shelfValue.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`
            : "–",
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <CategoryRadar counts={data.categoryCounts} />

        <div className="rounded-2xl border border-cask-800/70 bg-night-900/60 p-5">
          <h2 className="font-serif text-lg text-cask-100">Gaps to explore</h2>
          {data.missingCategories.length === 0 ? (
            <p className="mt-3 text-sm text-cask-200/60">
              You&apos;ve got a bottle in every category, a nicely rounded shelf. 🥃
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-cask-200/50">
                Styles you don&apos;t own yet:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.missingCategories.map((cat) => (
                  <span
                    key={cat}
                    className="rounded-full border border-cask-700/60 bg-night-950/60 px-3 py-1 text-xs capitalize text-cask-200/80"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </>
          )}
          <Link
            href="/discover"
            className="mt-5 inline-block rounded-lg bg-cask-500 px-4 py-2 text-sm font-semibold text-night-950 transition hover:bg-cask-400"
          >
            Let AI suggest bottles to fill them →
          </Link>
          {data.avgRating != null && (
            <p className="mt-4 text-sm text-cask-200/60">
              Average rating across what you&apos;ve tried:{" "}
              <span className="text-cask-100">★ {data.avgRating}/100</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BarList title="Countries" entries={data.countries} empty="No countries recorded yet." />
        <BarList title="Regions" entries={data.regions} empty="No regions recorded yet." />
        <BarList
          title="Top flavours"
          entries={data.flavours}
          empty="Add flavour tags to your bottles to see this."
          limit={12}
        />
        <BarList
          title="Distilleries"
          entries={data.distilleries}
          empty="No distilleries recorded yet."
        />
      </div>
    </div>
  );
}
