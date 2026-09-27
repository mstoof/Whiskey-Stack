"use client";

import type { Recommendation } from "@/lib/types";

/** Shared card for an AI bottle suggestion, used by Discover and Complete-the-set. */
export function RecommendationCard({
  rec,
  added,
  onAdd,
  saved,
  onSave,
}: {
  rec: Recommendation;
  added: boolean;
  onAdd: () => void;
  /** Omit to hide the "save" button (e.g. it's already a saved pick). */
  saved?: boolean;
  onSave?: () => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-cask-800/60 bg-night-800/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-serif text-lg text-cask-100">{rec.name}</h3>
          <p className="text-xs text-cask-200/60">
            {[rec.category, rec.country].filter(Boolean).join(" · ")}
          </p>
        </div>
        {rec.estPriceEur != null && (
          <div className="shrink-0 text-right">
            <div className="text-emerald-300">€{rec.estPriceEur.toFixed(2)}</div>
            {rec.retailer && <div className="text-[11px] text-cask-200/50">{rec.retailer}</div>}
          </div>
        )}
      </div>
      <p className="mt-2 text-sm text-cask-200/80">
        <span className="text-cask-300">Taste:</span> {rec.flavorProfile}
      </p>
      <p className="mt-1 text-sm text-cask-200/70">
        <span className="text-cask-300">Why:</span> {rec.reasoning}
      </p>
      <div className="mt-4 flex items-center gap-3 border-t border-cask-900/60 pt-3 text-xs">
        <button
          onClick={onAdd}
          disabled={added}
          className="font-medium text-cask-300 hover:text-cask-200 disabled:opacity-60"
        >
          {added ? "✓ On wishlist" : "+ Add to wishlist"}
        </button>
        {onSave && (
          <button
            onClick={onSave}
            disabled={saved}
            className="font-medium text-cask-300 hover:text-cask-200 disabled:opacity-60"
          >
            {saved ? "★ Saved" : "☆ Save for later"}
          </button>
        )}
        {rec.productUrl && (
          <a
            href={rec.productUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-cask-400 underline"
          >
            View at retailer →
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Fields `recToWishlistPayload` needs, satisfied structurally by both a live
 * `Recommendation` (from lib/types) and a `SavedRecommendationDTO` (from
 * lib/serialize, minus `abv` which that table doesn't store), so the same
 * mapping works for a fresh discovery result and a saved pick alike.
 */
interface RecommendationLike {
  name: string;
  distillery?: string | null;
  category?: string | null;
  country?: string | null;
  abv?: number | null;
  estPriceEur?: number | null;
  retailer?: string | null;
  flavorProfile?: string | null;
  reasoning?: string | null;
}

/** Map an AI recommendation (or a saved pick) to the wishlist payload for POST /api/bottles. */
export function recToWishlistPayload(r: RecommendationLike) {
  return {
    name: r.name,
    distillery: r.distillery ?? null,
    category: r.category ?? null,
    country: r.country ?? null,
    abv: r.abv ?? null,
    status: "wishlist",
    purchasePriceEur: r.estPriceEur ?? null,
    purchaseStore: r.retailer ?? null,
    flavorTags: r.flavorProfile
      ? r.flavorProfile.split(/[,;]/).map((s) => s.trim()).filter(Boolean).slice(0, 6)
      : [],
    notes: r.reasoning ?? null,
  };
}
