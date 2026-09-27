import type { PublicBottleDTO } from "@/lib/serialize";

const statusStyles: Record<string, string> = {
  owned: "bg-emerald-500/15 text-emerald-300",
  finished: "bg-night-800 text-cask-200/50",
};

/**
 * Read-only, presentational grid for the public shelf (`/u/[handle]`). This is
 * deliberately NOT BottleCard: that component is interactive (edit/delete,
 * price lookup) and renders private fields. This one can only render what
 * PublicBottleDTO carries, so it cannot leak private data.
 */
export function PublicShelf({ bottles }: { bottles: PublicBottleDTO[] }) {
  if (bottles.length === 0) {
    return (
      <p className="rounded-xl border border-cask-900/70 bg-night-900/40 p-6 text-sm text-cask-200/60">
        Nothing on the shelf yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {bottles.map((b) => {
        const subtitle = [b.category, b.country, b.region].filter(Boolean).join(" · ");
        return (
          <div key={b.id} className="flex flex-col rounded-xl border border-cask-800/60 bg-night-800/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-serif text-lg text-cask-100" title={b.name}>
                  {b.name}
                </h3>
                {subtitle && <p className="truncate text-xs text-cask-200/60">{subtitle}</p>}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  statusStyles[b.status] ?? statusStyles.owned
                }`}
              >
                {b.status}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-cask-200/70">
              {b.ageStatement != null && <span>{b.ageStatement} yo</span>}
              {b.abv != null && <span>{b.abv}% ABV</span>}
              {b.rating != null && <span className="text-cask-300">★ {b.rating}/100</span>}
            </div>

            {b.flavorTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {b.flavorTags.map((t) => (
                  <span key={t} className="rounded-full bg-cask-950/60 px-2 py-0.5 text-xs text-cask-200/80">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
