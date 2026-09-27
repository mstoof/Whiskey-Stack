import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { FlightItemSnapshot } from "./types";

/**
 * A bottle on your shelf, on your wishlist, or long finished.
 * `userId` is the Neon Auth (Stack) user id: every row is scoped to its owner.
 */
export const bottles = pgTable(
  "bottles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),

    name: text("name").notNull(),
    distillery: text("distillery"),
    country: text("country"),
    region: text("region"),
    // e.g. "single malt scotch", "bourbon", "rye", "irish", "japanese", "world"
    category: text("category"),
    ageStatement: integer("age_statement"),
    abv: numeric("abv"),

    // owned | wishlist | finished
    status: text("status").notNull().default("owned"),
    // personal score, 0–100
    rating: integer("rating"),

    purchasePriceEur: numeric("purchase_price_eur"),
    purchaseStore: text("purchase_store"),

    // Last found offer is shown on the wishlist; a target enables daily price watching.
    // The lastChecked* fields are written by the cron (app/api/cron/price-watch),
    // never by the user form. See toInsertValues in app/api/bottles/route.ts.
    targetPriceEur: numeric("target_price_eur"),
    lastCheckedPriceEur: numeric("last_checked_price_eur"),
    lastCheckedRetailer: text("last_checked_retailer"),
    lastCheckedUrl: text("last_checked_url"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    // Set when we last notified about a drop; cleared when the price rises back
    // above target, so each fresh drop can notify once.
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),

    // free-form flavour descriptors: ["sherry", "peat", "vanilla", ...]
    flavorTags: jsonb("flavor_tags").$type<string[]>().default([]).notNull(),
    notes: text("notes"),
    imageUrl: text("image_url"),

    // Short "what makes this bottle special" blurb, shown as a hover tooltip
    // on the collection card. Bilingual by design (not user-locale-switched,
    // the app has no i18n), distinct from `notes` (the user's own private
    // tasting notes): this is editorial/informational, not personal.
    descriptionEn: text("description_en"),
    descriptionNl: text("description_nl"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("bottles_user_idx").on(t.userId)],
);

/**
 * A recommendation the user chose to keep. Live discovery results are ephemeral;
 * these are the ones worth remembering (usually pinned to the wishlist too).
 */
export const savedRecommendations = pgTable(
  "saved_recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),

    name: text("name").notNull(),
    distillery: text("distillery"),
    category: text("category"),
    country: text("country"),

    flavorProfile: text("flavor_profile"),
    reasoning: text("reasoning"),

    estPriceEur: numeric("est_price_eur"),
    retailer: text("retailer"), // "Gall & Gall" | "Drankdozijn" | ...
    productUrl: text("product_url"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("saved_recs_user_idx").on(t.userId)],
);

/**
 * A curated, ordered lineup of bottles from the owner's shelf, with a title,
 * optional theme and per-pour notes. Each item is a self-contained snapshot
 * (see FlightItemSnapshot), so the public share page needs no join and leaks
 * nothing but the flight's own content. A non-null `shareToken` = public.
 */
export const flights = pgTable(
  "flights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),

    title: text("title").notNull(),
    theme: text("theme"),
    notes: text("notes"),

    // Ordered pours; rebuilt server-side from the owner's bottles on every save.
    items: jsonb("items").$type<FlightItemSnapshot[]>().default([]).notNull(),

    // null = private; a random token = shared read-only at /f/[token].
    shareToken: text("share_token"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("flights_user_idx").on(t.userId),
    // Unique per token; Postgres treats NULLs as distinct, so private flights
    // (shareToken = null) don't collide.
    uniqueIndex("flights_share_token_idx").on(t.shareToken),
  ],
);

/**
 * A user's public-shelf profile. One row per user (`userId` PK). A shelf is
 * private until the user picks a `handle` AND flips `isPublic` on. Only then
 * does `/u/[handle]` resolve. The unique `handle` is the public URL slug. This
 * table holds no bottle data; the public page joins to the owner's `bottles`
 * (owned + finished only) at read time via a privacy-safe serializer.
 */
export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id").primaryKey(),

    handle: text("handle").notNull(),
    displayName: text("display_name"),
    bio: text("bio"),
    isPublic: boolean("is_public").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("profiles_handle_idx").on(t.handle)],
);

/**
 * A daily snapshot of a user's collection value, written by the price-watch
 * cron (app/api/cron/price-watch), the one place that already runs daily and
 * already does price checks. `purchaseValueEur`/`ownedCount` are a pure SQL
 * aggregate over `bottles` (cost basis: what you paid for owned bottles), so
 * they're captured for every user regardless of Gemini being configured.
 * `marketValueEur` is the sum of `lastCheckedPriceEur` across currently
 * watched wishlist bottles that have been priced at least once, genuinely
 * "using price checks", and stays null until the user watches something.
 * One row per user per calendar `date` (upserted on conflict), so a second
 * cron run the same day updates rather than duplicates.
 */
export const valueSnapshots = pgTable(
  "value_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    date: date("date").notNull(),

    purchaseValueEur: numeric("purchase_value_eur").notNull(),
    ownedCount: integer("owned_count").notNull(),
    marketValueEur: numeric("market_value_eur"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("value_snapshots_user_date_idx").on(t.userId, t.date)],
);

export type Bottle = typeof bottles.$inferSelect;
export type NewBottle = typeof bottles.$inferInsert;
export type SavedRecommendation = typeof savedRecommendations.$inferSelect;
export type Flight = typeof flights.$inferSelect;
export type NewFlight = typeof flights.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type ValueSnapshot = typeof valueSnapshots.$inferSelect;
