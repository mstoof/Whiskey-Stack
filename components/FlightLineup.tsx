import type { FlightItemSnapshot } from "@/lib/types";

/** Compact "category · country · region" line, with abv/age appended. */
function meta(item: FlightItemSnapshot): string {
  const bits = [item.category, item.country, item.region].filter(Boolean) as string[];
  const extra: string[] = [];
  if (item.ageStatement != null) extra.push(`${item.ageStatement} yo`);
  if (item.abv != null) extra.push(`${item.abv}%`);
  return [...bits, ...extra].join(" · ");
}

/**
 * Pure presentational ordered list of a flight's pours. Reused by the public
 * share page and any owner-side preview. No interactivity, no data fetching.
 */
export function FlightLineup({ items }: { items: FlightItemSnapshot[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li
          key={`${item.bottleId}-${i}`}
          className="flex gap-4 rounded-xl border border-cask-800/60 bg-night-800/40 p-4"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cask-500/15 font-serif text-sm font-bold text-cask-200">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-lg text-cask-100">{item.name}</h3>
            {meta(item) && <p className="text-xs text-cask-200/50">{meta(item)}</p>}
            {item.note && <p className="mt-1.5 text-sm text-cask-200/80">{item.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
