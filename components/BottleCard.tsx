"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { BottleDTO } from "@/lib/serialize";
import { BOTTLE_STATUS_LABELS, type PriceOffer } from "@/lib/types";
import { purchasableOffers, retailerUrl } from "@/lib/prices";
import { useLanguage } from "./LanguageProvider";

interface Props {
  bottle: BottleDTO;
  onEdit: (b: BottleDTO) => void;
  onDelete: (id: string) => void;
}

const statusStyles: Record<string, string> = {
  owned: "bg-emerald-500/15 text-emerald-300",
  wishlist: "bg-cask-500/15 text-cask-300",
  finished: "bg-night-800 text-cask-200/50",
};

export function BottleCard({ bottle: b, onEdit, onDelete }: Props) {
  const { language } = useLanguage();
  const photoDialog = useRef<HTMLDialogElement>(null);
  const [savedPrice, setSavedPrice] = useState({
    price: b.lastCheckedPriceEur,
    retailer: b.lastCheckedRetailer,
    url: b.lastCheckedUrl,
    checkedAt: b.lastCheckedAt,
  });
  const [checkingPrice, setCheckingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [offers, setOffers] = useState<PriceOffer[] | null>(null);

  useEffect(() => {
    setSavedPrice({ price: b.lastCheckedPriceEur, retailer: b.lastCheckedRetailer, url: b.lastCheckedUrl, checkedAt: b.lastCheckedAt });
  }, [b.id, b.lastCheckedPriceEur, b.lastCheckedRetailer, b.lastCheckedUrl, b.lastCheckedAt]);

  async function lookupPrice() {
    setCheckingPrice(true);
    setPriceError(null);
    try {
      const response = await fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: b.name, bottleId: b.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Price lookup failed.");
      const found = purchasableOffers(body.offers as PriceOffer[]);
      const cheapest = found[0];
      setOffers(found);
      setSavedPrice({
        price: cheapest?.priceEur ?? null,
        retailer: cheapest?.retailer ?? null,
        url: cheapest?.productUrl ?? null,
        checkedAt: body.checkedAt,
      });
    } catch (error) {
      setPriceError(error instanceof Error ? error.message : "Price lookup failed.");
    } finally {
      setCheckingPrice(false);
    }
  }

  const subtitle = [b.category, b.country, b.region].filter(Boolean).join(" · ");
  const watching = b.status === "wishlist" && b.targetPriceEur != null;
  const dropped =
    watching && savedPrice.price != null && savedPrice.price <= b.targetPriceEur!;
  const buyUrl = retailerUrl(savedPrice.url);
  const checkedOn = savedPrice.checkedAt
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(savedPrice.checkedAt))
    : null;
  // "What makes this special" tooltip, in whichever language the nav's EN/NL
  // toggle is set to (LanguageProvider). Falls back to the other language if
  // the preferred one isn't set, rather than hiding a description that does
  // exist. Rendered as a real CSS hover panel (below), not the native `title`
  // attribute: browsers delay `title` by ~1s, render it inconsistently, and
  // skip it entirely on touch, which is what made it feel "not working."
  const descriptionEn = b.descriptionEn?.trim();
  const descriptionNl = b.descriptionNl?.trim();
  const preferred = language === "nl" ? descriptionNl : descriptionEn;
  const fallback = language === "nl" ? descriptionEn : descriptionNl;
  const description = preferred || fallback;
  const isFallback = !preferred && Boolean(fallback);
  const imageUrl = b.imageUrl?.trim() || null;
  // A photo alone (no description yet) is still worth a hover, so don't gate
  // the whole tooltip on description existing.
  const hasHoverContent = true;

  return (
    <div className="flex h-full flex-col rounded-xl border border-cask-800/60 bg-night-800/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="whitespace-normal break-words font-serif text-lg leading-tight text-cask-100" title={b.name}>{b.name}</h3>
            {hasHoverContent && (
              <div className="group/desc relative shrink-0">
                <button
                  type="button"
                  aria-label={imageUrl ? `View photo of ${b.name}` : "Description"}
                  onClick={() => photoDialog.current?.showModal()}
                  className="cursor-help text-cask-200/40 hover:text-cask-200"
                >
                  ⓘ
                </button>
                <div
                  
                  className="invisible absolute left-0 top-full z-30 w-64 max-w-[80vw] rounded-lg border border-cask-800/70 bg-night-900 p-3 text-xs leading-relaxed text-cask-200/90 opacity-0 shadow-xl transition-opacity duration-100 group-hover/desc:visible group-focus-within/desc:visible group-hover/desc:opacity-100 group-focus-within/desc:opacity-100"
                >
                  {imageUrl && (
                    <button type="button" onClick={() => photoDialog.current?.showModal()} aria-label={`Enlarge photo of ${b.name}`} className="relative mb-2 block h-56 w-full cursor-zoom-in overflow-hidden rounded-md border border-cask-800/60 bg-night-950/60">
                      <Image
                        src={imageUrl}
                        alt={b.name}
                        fill
                        sizes="256px"
                        className="object-contain object-center p-5"
                        style={{ objectFit: "contain", objectPosition: "center" }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </button>
                  )}
                  {description ? <p>{description}</p> : <p className="text-cask-200/60">Bottle details will be added soon.</p>}
                  {isFallback && (
                    <p className="mt-1.5 text-[10px] uppercase tracking-wide text-cask-200/40">
                      No {language.toUpperCase()} description yet
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          {subtitle && <p className="truncate text-xs text-cask-200/60">{subtitle}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[b.status] ?? statusStyles.owned}`}>
          {BOTTLE_STATUS_LABELS[b.status] ?? b.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-cask-200/70">
        {b.ageStatement != null && <span>{b.ageStatement} years</span>}
        {b.abv != null && <span>{b.abv}% ABV</span>}
        {b.rating != null && <span className="text-cask-300">★ {b.rating}/100</span>}
        {b.purchasePriceEur != null && <span>paid €{b.purchasePriceEur.toFixed(2)}</span>}
      </div>

      {b.flavorTags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-1.5 gap-y-2">
          {b.flavorTags.map((t) => (
            <span key={t} className="rounded-full bg-cask-950/60 px-2 py-0.5 text-xs text-cask-200/80">{t}</span>
          ))}
        </div>
      )}

      {b.notes && <p className="mt-3 line-clamp-3 text-sm text-cask-200/70">{b.notes}</p>}

      {b.status === "wishlist" && (
        <div className="my-4 rounded-lg border border-cask-800/60 bg-night-900/60 p-3">
          <p className="text-xs text-cask-200/60">Lowest price found · 70cl</p>
          {savedPrice.price != null && buyUrl ? (
            <>
              <p className="mt-1 text-xl font-semibold text-cask-100">€{savedPrice.price.toFixed(2)}</p>
              <a href={buyUrl} target="_blank" rel="noopener noreferrer"
                className="mt-2 block rounded-lg bg-cask-500 px-3 py-2 text-center text-sm font-semibold text-night-950 hover:bg-cask-400">
                View at {savedPrice.retailer || "store"} ↗
              </a>
              <p className="mt-2 text-xs text-cask-200/50">{checkedOn && `Checked ${checkedOn}. `}Excludes delivery. Confirm the price at the store.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-cask-200/60">
              No retailer link saved yet.
            </p>
          )}
          {priceError && <p className="mt-2 text-xs text-red-400">{priceError}</p>}
          {offers && offers.length === 0 && <p className="mt-2 text-xs text-cask-200/60">No current offer was found.</p>}
          {watching && (
            <p className={`mt-2 text-xs ${dropped ? "text-emerald-300" : "text-cask-200/60"}`}>
              Target: €{b.targetPriceEur!.toFixed(2)}{dropped ? " · At or below your target" : ""}
            </p>
          )}
        </div>
      )}

      <div className={`mt-auto grid gap-2 border-t border-cask-900/60 pt-3 text-xs ${b.status === "wishlist" ? "grid-cols-3" : "grid-cols-2"}`}>
        {b.status === "wishlist" && <button
          onClick={lookupPrice}
          disabled={checkingPrice}
          className="rounded-lg border border-cask-700/60 bg-night-900/50 px-2 py-1.5 font-medium text-cask-200 transition hover:border-cask-500 hover:bg-cask-500/10 hover:text-cask-100 disabled:opacity-50"
        >
          {checkingPrice ? "Checking…" : "Prices"}
        </button>}
        <button
          onClick={() => onEdit(b)}
          className="rounded-lg border border-cask-700/60 bg-night-900/50 px-2 py-1.5 font-medium text-cask-200 transition hover:border-cask-500 hover:bg-cask-500/10 hover:text-cask-100"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(b.id)}
          className="rounded-lg border border-red-900/50 bg-red-950/20 px-2 py-1.5 font-medium text-red-400 transition hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-300"
        >
          Delete
        </button>
      </div>
      {imageUrl && (
        <dialog ref={photoDialog} aria-label={`Photo of ${b.name}`}
          onClick={(event) => { if (event.target === event.currentTarget) photoDialog.current?.close(); }}
          className="fixed inset-0 m-auto w-[92vw] max-w-4xl rounded-xl border border-cask-800 bg-night-900 p-4 text-cask-100 backdrop:bg-black/80">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="font-serif text-lg">{b.name}</p>
            <button type="button" autoFocus onClick={() => photoDialog.current?.close()}
              className="rounded-lg border border-cask-700 px-3 py-2" aria-label="Close photo">Close ✕</button>
          </div>
          <div className="relative h-[75dvh] w-full">
            <Image src={imageUrl} alt={b.name} fill sizes="(max-width: 1024px) 92vw, 896px"
              className="object-contain" style={{ objectFit: "contain" }} />
          </div>
          {description && <p className="mt-4 max-w-3xl text-sm leading-relaxed text-cask-200/85">{description}</p>}
        </dialog>
      )}
    </div>
  );
}
