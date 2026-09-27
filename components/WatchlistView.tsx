"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { BottleDTO } from "@/lib/serialize";
import { retailerNamesLabel } from "@/lib/types";

/** Is this watched bottle currently at or below its target price? */
function isDropped(b: BottleDTO): boolean {
  return b.targetPriceEur != null && b.lastCheckedPriceEur != null && b.lastCheckedPriceEur <= b.targetPriceEur;
}

export function WatchlistView({ bottles }: { bottles: BottleDTO[] }) {
  // Drops first, then bottles already checked, then not-yet-checked.
  const sorted = useMemo(() => {
    const rank = (b: BottleDTO) => (isDropped(b) ? 0 : b.lastCheckedPriceEur != null ? 1 : 2);
    return [...bottles].sort((a, b) => rank(a) - rank(b));
  }, [bottles]);

  const dropCount = bottles.filter(isDropped).length;

  return (
    <div>
      <h1 className="font-serif text-3xl text-cask-100">Watchlist</h1>
      <p className="mt-1 max-w-2xl text-sm text-cask-200/60">
        Wishlist bottles with a target price. We re-check {retailerNamesLabel()}
        daily and flag any that drop to your target.
        {bottles.length > 0 && (
          <>
            {" "}
            Watching <span className="text-cask-100">{bottles.length}</span>
            {dropCount > 0 && <> · <span className="text-emerald-300">{dropCount} dropped</span></>}.
          </>
        )}
      </p>

      {bottles.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-dashed border-cask-800/60 p-12 text-center">
          <p className="text-cask-200/60">
            Nothing on watch yet. Add a bottle to your{" "}
            <Link href="/wishlist" className="text-cask-300 underline">wishlist</Link>{" "}
            and set a target price to start watching it.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {sorted.map((b) => {
              const dropped = isDropped(b);
              const checkedOn = b.lastCheckedAt
                ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(b.lastCheckedAt))
                : null;
              return (
                <div
                  key={b.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-4 ${
                    dropped ? "border-emerald-600/40 bg-emerald-500/10" : "border-cask-800/60 bg-night-800/40"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-serif text-lg text-cask-100" title={b.name}>{b.name}</h3>
                      {dropped && (
                        <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                          Price dropped!
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-cask-200/50">
                      {[b.category, b.country, b.region].filter(Boolean).join(" · ")}
                    </p>
                  </div>

                  <div className="text-right text-sm">
                    <p className="text-cask-200/60">🎯 €{b.targetPriceEur!.toFixed(2)}</p>
                    {b.lastCheckedPriceEur != null ? (
                      <p className={dropped ? "font-semibold text-emerald-300" : "text-cask-200"}>
                        now €{b.lastCheckedPriceEur.toFixed(2)}
                        {b.lastCheckedRetailer ? <span className="text-cask-200/40"> · {b.lastCheckedRetailer}</span> : null}
                      </p>
                    ) : (
                      <p className="text-xs text-cask-200/40">not checked yet</p>
                    )}
                    {checkedOn && <p className="text-[11px] text-cask-200/40">checked {checkedOn}</p>}
                  </div>

                  {b.lastCheckedUrl && (
                    <a
                      href={b.lastCheckedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-lg border border-cask-700/60 px-3 py-1.5 text-xs text-cask-200 hover:border-cask-500 hover:text-cask-100"
                    >
                      View offer
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-[11px] text-cask-200/40">
            Prices are AI estimates from web search. Always verify on the retailer&apos;s site before buying.
            Please drink responsibly.
          </p>
        </>
      )}
    </div>
  );
}
