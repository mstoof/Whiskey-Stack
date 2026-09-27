import type { Bottle, Flight, Profile, SavedRecommendation, ValueSnapshot } from "./schema";
import type { FlightItemSnapshot } from "./types";

/** JSON-safe bottle shape shared between server and client components. */
export interface BottleDTO {
  id: string;
  name: string;
  distillery: string | null;
  country: string | null;
  region: string | null;
  category: string | null;
  ageStatement: number | null;
  abv: number | null;
  status: string;
  rating: number | null;
  purchasePriceEur: number | null;
  purchaseStore: string | null;
  targetPriceEur: number | null;
  lastCheckedPriceEur: number | null;
  lastCheckedRetailer: string | null;
  lastCheckedUrl: string | null;
  lastCheckedAt: string | null;
  flavorTags: string[];
  notes: string | null;
  imageUrl: string | null;
  descriptionEn: string | null;
  descriptionNl: string | null;
  createdAt: string;
  updatedAt: string;
}

const num = (v: string | null): number | null => (v == null ? null : Number(v));

export function serializeBottle(b: Bottle): BottleDTO {
  return {
    id: b.id,
    name: b.name,
    distillery: b.distillery,
    country: b.country,
    region: b.region,
    category: b.category,
    ageStatement: b.ageStatement,
    abv: num(b.abv),
    status: b.status,
    rating: b.rating,
    purchasePriceEur: num(b.purchasePriceEur),
    purchaseStore: b.purchaseStore,
    targetPriceEur: num(b.targetPriceEur),
    lastCheckedPriceEur: num(b.lastCheckedPriceEur),
    lastCheckedRetailer: b.lastCheckedRetailer,
    lastCheckedUrl: b.lastCheckedUrl,
    lastCheckedAt: b.lastCheckedAt ? b.lastCheckedAt.toISOString() : null,
    flavorTags: b.flavorTags ?? [],
    notes: b.notes,
    imageUrl: b.imageUrl,
    descriptionEn: b.descriptionEn,
    descriptionNl: b.descriptionNl,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

/** JSON-safe flight shape. `items` are already snapshots (see FlightItemSnapshot). */
export interface FlightDTO {
  id: string;
  title: string;
  theme: string | null;
  notes: string | null;
  items: FlightItemSnapshot[];
  // The owner sees their own token to build the /f/[token] share link; null = private.
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export function serializeFlight(f: Flight): FlightDTO {
  return {
    id: f.id,
    title: f.title,
    theme: f.theme,
    notes: f.notes,
    items: f.items ?? [],
    shareToken: f.shareToken,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

/**
 * Privacy-safe bottle shape for the PUBLIC shelf (`/u/[handle]`). Deliberately
 * omits everything personal: purchase price, store, price-watch target, all
 * `lastChecked*`, notes and imageUrl. The public page can only render what this
 * returns, so private columns physically cannot leak. Never widen this shape
 * without a matching product decision.
 */
export interface PublicBottleDTO {
  id: string;
  name: string;
  distillery: string | null;
  country: string | null;
  region: string | null;
  category: string | null;
  ageStatement: number | null;
  abv: number | null;
  status: string; // "owned" | "finished" only reach the public shelf
  rating: number | null;
  flavorTags: string[];
}

export function serializePublicBottle(b: Bottle): PublicBottleDTO {
  return {
    id: b.id,
    name: b.name,
    distillery: b.distillery,
    country: b.country,
    region: b.region,
    category: b.category,
    ageStatement: b.ageStatement,
    abv: num(b.abv),
    status: b.status,
    rating: b.rating,
    flavorTags: b.flavorTags ?? [],
  };
}

/**
 * JSON-safe saved-recommendation shape: a discovery/complete-the-set pick the
 * user chose to keep. Note there's no `abv`: the table predates that field on
 * `Recommendation`, so a saved pick loses it (minor, non-critical for a list
 * of picks, and avoids a migration for this feature).
 */
export interface SavedRecommendationDTO {
  id: string;
  name: string;
  distillery: string | null;
  category: string | null;
  country: string | null;
  flavorProfile: string | null;
  reasoning: string | null;
  estPriceEur: number | null;
  retailer: string | null;
  productUrl: string | null;
  createdAt: string;
}

export function serializeSavedRecommendation(r: SavedRecommendation): SavedRecommendationDTO {
  return {
    id: r.id,
    name: r.name,
    distillery: r.distillery,
    category: r.category,
    country: r.country,
    flavorProfile: r.flavorProfile,
    reasoning: r.reasoning,
    estPriceEur: num(r.estPriceEur),
    retailer: r.retailer,
    productUrl: r.productUrl,
    createdAt: r.createdAt.toISOString(),
  };
}

/** JSON-safe daily value snapshot. See `valueSnapshots` in schema.ts. */
export interface ValueSnapshotDTO {
  date: string; // "YYYY-MM-DD"
  purchaseValueEur: number;
  ownedCount: number;
  marketValueEur: number | null;
}

export function serializeValueSnapshot(v: ValueSnapshot): ValueSnapshotDTO {
  return {
    date: v.date,
    purchaseValueEur: Number(v.purchaseValueEur),
    ownedCount: v.ownedCount,
    marketValueEur: v.marketValueEur == null ? null : Number(v.marketValueEur),
  };
}

/** JSON-safe profile shape for the settings client. */
export interface ProfileDTO {
  handle: string;
  displayName: string | null;
  bio: string | null;
  isPublic: boolean;
}

export function serializeProfile(p: Profile): ProfileDTO {
  return {
    handle: p.handle,
    displayName: p.displayName,
    bio: p.bio,
    isPublic: p.isPublic,
  };
}
