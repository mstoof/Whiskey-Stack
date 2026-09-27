"use client";

import Link from "next/link";
import { useState } from "react";
import type { SavedRecommendationDTO } from "@/lib/serialize";
import { recToWishlistPayload } from "./RecommendationCard";

export function PicksView({ recs }: { recs: SavedRecommendationDTO[] }) {
  const [items, setItems] = useState(recs);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [removing, setRemoving] = useState<Record<string, boolean>>({});

  async function addToWishlist(r: SavedRecommendationDTO) {
    setAdded((a) => ({ ...a, [r.id]: true }));
    await fetch("/api/bottles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recToWishlistPayload(r)),
    });
  }

  async function remove(r: SavedRecommendationDTO) {
    setRemoving((s) => ({ ...s, [r.id]: true }));
    const res = await fetch(`/api/recommendations/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((list) => list.filter((x) => x.id !== r.id));
    } else {
      setRemoving((s) => ({ ...s, [r.id]: false }));
    }
  }

  return (
    <div>
      <h1 className="font-serif text-3xl text-cask-100">Picks</h1>
      <p className="mt-1 max-w-2xl text-sm text-cask-200/60">
        Bottles you saved for later from Discover and Complete the set.
        {items.length > 0 && (
          <> Keeping <span className="text-cask-100">{items.length}</span>.</>
        )}
      </p>

      {items.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-dashed border-cask-800/60 p-12 text-center">
          <p className="text-cask-200/60">
            Nothing saved yet. Hit <span className="text-cask-300">☆ Save for later</span> on a
            bottle in <Link href="/discover" className="text-cask-300 underline">Discover</Link>{" "}
            or <Link href="/complete" className="text-cask-300 underline">Complete the set</Link>.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {items.map((r) => (
              <div
                key={r.id}
                className="flex flex-col rounded-xl border border-cask-800/60 bg-night-800/40 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-serif text-lg text-cask-100">{r.name}</h3>
                    <p className="text-xs text-cask-200/60">
                      {[r.category, r.country].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {r.estPriceEur != null && (
                    <div className="shrink-0 text-right">
                      <div className="text-emerald-300">€{r.estPriceEur.toFixed(2)}</div>
                      {r.retailer && <div className="text-[11px] text-cask-200/50">{r.retailer}</div>}
                    </div>
                  )}
                </div>
                {r.flavorProfile && (
                  <p className="mt-2 text-sm text-cask-200/80">
                    <span className="text-cask-300">Taste:</span> {r.flavorProfile}
                  </p>
                )}
                {r.reasoning && (
                  <p className="mt-1 text-sm text-cask-200/70">
                    <span className="text-cask-300">Why:</span> {r.reasoning}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-3 border-t border-cask-900/60 pt-3 text-xs">
                  <button
                    onClick={() => addToWishlist(r)}
                    disabled={!!added[r.id]}
                    className="font-medium text-cask-300 hover:text-cask-200 disabled:opacity-60"
                  >
                    {added[r.id] ? "✓ On wishlist" : "+ Add to wishlist"}
                  </button>
                  <button
                    onClick={() => remove(r)}
                    disabled={!!removing[r.id]}
                    className="text-cask-200/50 hover:text-red-400 disabled:opacity-60"
                  >
                    Remove
                  </button>
                  {r.productUrl && (
                    <a
                      href={r.productUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto text-cask-400 underline"
                    >
                      View at retailer →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[11px] text-cask-200/40">
            Prices are AI estimates from when you saved this pick. Always verify on the
            retailer&apos;s site before buying.
          </p>
        </>
      )}
    </div>
  );
}
