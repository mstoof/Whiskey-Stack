import { z } from "zod";

// ─── NL retailers ───────────────────────────────────────────────────────────

/**
 * The Dutch retailers we price against, in one place. Lives here (not
 * lib/gemini.ts) because it's pure config with no server-only deps. Both the
 * AI prompts and client UI copy import it, so adding a retailer means editing
 * this list once instead of hunting down hardcoded names in prompts and JSX.
 */
export const NL_RETAILERS = [
  { name: "Gall & Gall", site: "gall.nl" },
  { name: "Drankdozijn", site: "drankdozijn.nl" },
  { name: "Mitra", site: "mitra.nl" },
  { name: "Slijterij-online", site: "slijterij-online.nl" },
  { name: "AceDrinks", site: "acedrinks.nl" },
  { name: "'t Bockje Bathmen", site: "bockjebathmen.nl" },
  { name: "Slijterij Vonk", site: "slijterijvonk.nl" },
  { name: "Whisky.nl", site: "whisky.nl" },
  { name: "WhiskyXL", site: "whiskyxl.nl" },
  { name: "Gevo Slijterij", site: "gevoslijterij.nl" },
  { name: "Wijnhuis Rhoon", site: "wijnhuisrhoon.nl" },
  { name: "De Groene Slijter", site: "degroeneslijter.nl" },
  { name: "Whiskykoning", site: "whiskykoning.nl" },
  { name: "Drankenshop Broekmans", site: "nl.broekmans.be" },
  { name: "Whiskybase Shop", site: "shop.whiskybase.com" },
  { name: "Van Eccelpoel", site: "vaneccelpoelwijnen.be" },
] as const;

export type NLRetailer = (typeof NL_RETAILERS)[number];

/** "Gall & Gall, Drankdozijn, Mitra and Slijterij-online": for UI copy. */
export function retailerNamesLabel(
  retailers: readonly { name: string }[] = NL_RETAILERS,
): string {
  const names = retailers.map((r) => r.name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export const BOTTLE_STATUSES = ["owned", "wishlist", "finished"] as const;
export const BOTTLE_STATUS_LABELS: Record<string, string> = {
  owned: "On the shelf",
  wishlist: "On the wishlist",
  finished: "Finished",
};
export type BottleStatus = (typeof BOTTLE_STATUSES)[number];

export const CATEGORIES = [
  "single malt scotch",
  "blended scotch",
  "bourbon",
  "rye",
  "irish",
  "japanese",
  "world whisky",
  "other",
  "Unique choices",
  "Luxury Whisky's",
] as const;

/** Validation for creating/updating a bottle from the client. */
export const bottleInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  distillery: z.string().max(200).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  ageStatement: z.coerce.number().int().min(0).max(100).optional().nullable(),
  abv: z.coerce.number().min(0).max(100).optional().nullable(),
  status: z.enum(BOTTLE_STATUSES).default("owned"),
  rating: z.coerce.number().int().min(0).max(100).optional().nullable(),
  purchasePriceEur: z.coerce.number().min(0).optional().nullable(),
  purchaseStore: z.string().max(120).optional().nullable(),
  // Price-watch target: re-priced daily while status is "wishlist".
  targetPriceEur: z.coerce.number().min(0).optional().nullable(),
  flavorTags: z.array(z.string().max(40)).max(30).default([]),
  notes: z.string().max(4000).optional().nullable(),
  // Either a full URL (AI-found or user-pasted) or a root-relative path to a
  // file served from public/ (self-hosted photos, e.g. /bottles/name.jpg).
  imageUrl: z
    .string()
    .max(1000)
    .refine((v) => /^https?:\/\//.test(v) || v.startsWith("/"), "Must be a URL or a path starting with /")
    .optional()
    .nullable()
    .or(z.literal("")),
  // "What makes this bottle special": shown as a hover tooltip, not the
  // user's personal tasting notes (that's `notes`, above).
  descriptionEn: z.string().max(600).optional().nullable(),
  descriptionNl: z.string().max(600).optional().nullable(),
});

export type BottleInput = z.infer<typeof bottleInputSchema>;

/** Upper bound on rows accepted in a single CSV/JSON import (bounds the bulk insert). */
export const MAX_IMPORT_ROWS = 2000;

// ─── Public shelf profile ──────────────────────────────────────────────────

/** Public-shelf handle: 3–30 chars, lowercase letters/digits/hyphens, no
 * leading or trailing hyphen. It becomes the `/u/[handle]` URL slug. */
export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/** Handles we never let a user claim: they'd shadow real routes or auth paths. */
export const RESERVED_HANDLES = new Set([
  "u", "api", "f", "handler", "collection", "wishlist", "discover", "complete", "picks",
  "watchlist", "flights", "insights", "value", "settings", "sign-in", "sign-up", "account",
]);

/** Validation for creating/updating a user's public-shelf profile. */
export const profileInputSchema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(HANDLE_RE, "3–30 characters: lowercase letters, numbers and hyphens")
    .refine((h) => !RESERVED_HANDLES.has(h), "That handle is reserved"),
  displayName: z.string().trim().max(60).optional().nullable(),
  bio: z.string().trim().max(280).optional().nullable(),
  isPublic: z.boolean().default(false),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

/** A single AI discovery result. */
export const recommendationSchema = z.object({
  name: z.string(),
  distillery: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  abv: z.number().optional().nullable(),
  flavorProfile: z.string(),
  reasoning: z.string(),
  estPriceEur: z.number().optional().nullable(),
  retailer: z.string().optional().nullable(),
  productUrl: z.string().optional().nullable(),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

/** A price candidate from a Dutch retailer for one specific bottle. */
export const priceOfferSchema = z.object({
  retailer: z.string(),
  priceEur: z.number().optional().nullable(),
  productUrl: z.string().optional().nullable(),
  volumeMl: z.number().optional().nullable(),
  note: z.string().optional().nullable(),
});

export type PriceOffer = z.infer<typeof priceOfferSchema>;

/**
 * Bottle details read off a label photo. Every field is best-effort. No price:
 * identifying a label needs no search, so pricing is a deliberately separate,
 * fast follow-up call to `findCheapestOffers` (see lib/gemini.ts,
 * lib/openrouter.ts) once the client has a name to search for.
 */
export const bottleVisionSchema = z.object({
  identified: z.boolean().default(true),
  name: z.string().optional().nullable(),
  distillery: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  ageStatement: z.number().int().optional().nullable(),
  abv: z.number().optional().nullable(),
  flavorTags: z.array(z.string().max(40)).max(30).optional().nullable(),
});

export type BottleVision = z.infer<typeof bottleVisionSchema>;

// ─── Tasting flights ─────────────────────────────────────────────────────────

/** Most bottles allowed in a single flight (keeps a tasting sensible + honest). */
export const MAX_FLIGHT_ITEMS = 12;

/**
 * One pour in a flight: a server-built snapshot of the bottle's display fields
 * (so the public share page renders with no join and survives the bottle later
 * being edited or deleted) plus a per-pour tasting note, keyed by `bottleId`.
 * `abv`/`ageStatement` are plain numbers here: this lives inside jsonb, so no
 * numeric-string dance.
 */
export const flightItemSnapshotSchema = z.object({
  bottleId: z.string().uuid(),
  name: z.string(),
  category: z.string().nullable(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  abv: z.number().nullable(),
  ageStatement: z.number().nullable(),
  note: z.string().max(500).nullable(),
});

export type FlightItemSnapshot = z.infer<typeof flightItemSnapshotSchema>;

/**
 * Client → server payload for creating/updating a flight. The client sends only
 * `bottleId` + `note` per item (in order); the server rebuilds the trusted
 * snapshots from the user's own bottles. `shared` toggles the public link.
 */
export const flightInputSchema = z.object({
  title: z.string().min(1, "Give your flight a title").max(200),
  theme: z.string().max(120).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  shared: z.boolean().default(false),
  items: z
    .array(
      z.object({
        bottleId: z.string().uuid(),
        note: z.string().max(500).optional().nullable(),
      }),
    )
    .min(1, "Add at least one bottle")
    .max(MAX_FLIGHT_ITEMS, `A flight can hold at most ${MAX_FLIGHT_ITEMS} bottles`),
});

export type FlightInput = z.infer<typeof flightInputSchema>;

/**
 * AI "suggest a flight" output. `index` refers to the 1-based numbered list of
 * the user's owned bottles in the prompt (mapped back to `bottleId` server-side).
 */
export const flightBuildResultSchema = z.object({
  title: z.string(),
  theme: z.string(),
  steps: z
    .array(
      z.object({
        index: z.number().int().min(1),
        note: z.string(),
      }),
    )
    .min(2),
});

export type FlightBuildResult = z.infer<typeof flightBuildResultSchema>;
