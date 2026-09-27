import { GoogleGenAI } from "@google/genai";
import {
  recommendationSchema,
  priceOfferSchema,
  bottleVisionSchema,
  CATEGORIES,
  type Recommendation,
  type PriceOffer,
  type BottleVision,
  type FlightBuildResult,
} from "./types";
import type { Bottle } from "./schema";
import { z } from "zod";
import {
  extractJson,
  collectionSummary,
  RETAILER_INLINE,
  RETAILER_BULLETS,
  RETAILER_ENUM_HINT,
  buildTastingFlightPrompt,
  parseFlightBuildResult,
} from "./aiShared";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set. AI discovery is disabled.");
    this.name = "GeminiNotConfiguredError";
  }
}

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();
  return new GoogleGenAI({ apiKey });
}

async function grounded(prompt: string): Promise<string> {
  const res = await client().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      temperature: 0.7,
    },
  });
  const text = res.text;
  if (!text) throw new Error("Empty response from Gemini.");
  return text;
}

export interface DiscoverParams {
  bottles: Bottle[];
  preferences?: string; // free text: "peaty, under €60, something from Japan"
  count?: number;
}

/**
 * Suggest new bottles that expand the collection, biased toward things that are
 * actually buyable in the Netherlands at Gall & Gall or Drankdozijn.
 */
export async function discoverWhiskeys({
  bottles,
  preferences,
  count = 6,
}: DiscoverParams): Promise<Recommendation[]> {
  const prompt = `You are a knowledgeable whisky buyer for someone in the Netherlands.

Their current collection:
${collectionSummary(bottles)}

Extra preferences for this search: ${preferences?.trim() || "none given, surprise them, but broaden the collection sensibly."}

Recommend ${count} DIFFERENT bottles they do NOT already own that would expand their collection in an interesting way (new regions, styles, distilleries, or flavour profiles they are missing). Every bottle MUST be realistically purchasable in the Netherlands at one of: ${RETAILER_INLINE}. Use Google Search to check current availability and the cheapest price across these retailers.

Return ONLY a JSON array, no prose, of exactly ${count} objects with this shape:
[{
  "name": "full bottle name",
  "distillery": "distillery or brand",
  "category": "single malt scotch | bourbon | rye | irish | japanese | world whisky | ...",
  "country": "country of origin",
  "abv": 43.0,
  "flavorProfile": "one short sentence on the taste",
  "reasoning": "one sentence on why it fits and how it expands their collection",
  "estPriceEur": 49.99,
  "retailer": "${RETAILER_ENUM_HINT}",
  "productUrl": "direct product link at the cheapest retailer"
}]
Use null for anything you genuinely cannot determine. Prefer 70cl bottles. Pick the cheapest retailer for estPriceEur/retailer/productUrl.`;

  const text = await grounded(prompt);
  const parsed = z.array(recommendationSchema).safeParse(extractJson(text));
  if (!parsed.success) throw new Error("Could not parse recommendations from Gemini.");
  return parsed.data;
}

/**
 * Find the cheapest current offer for one specific bottle across the two NL retailers.
 */
export async function findCheapestOffers(bottleName: string): Promise<PriceOffer[]> {
  const prompt = `Using Google Search, find the current price of the whisky "${bottleName}" at these Dutch retailers:
${RETAILER_BULLETS}

Return ONLY a JSON array (no prose) with one object per retailer that stocks it:
[{
  "retailer": "${RETAILER_ENUM_HINT}",
  "priceEur": 39.99,
  "productUrl": "direct product link",
  "volumeMl": 700,
  "note": "optional short note, e.g. 'on offer' or 'out of stock'"
}]
Only include currently in-stock standard 70cl (700 ml) bottles with a real direct product page and a verified EUR price available to everyone. Exclude membership prices, multipacks, miniatures and out-of-stock offers. Use null for unknown fields. Sort by bottle price excluding delivery, cheapest first.`;

  const text = await grounded(prompt);
  const parsed = z.array(priceOfferSchema).safeParse(extractJson(text));
  if (!parsed.success) throw new Error("Could not parse price offers from Gemini.");
  return parsed.data
    .filter((o) => o.priceEur != null)
    .sort((a, b) => (a.priceEur ?? Infinity) - (b.priceEur ?? Infinity));
}

/**
 * Read a whisky label from a photo and return structured bottle details to
 * prefill the add-bottle form. The label is the source of truth for
 * name/abv/age; the model infers country/region/flavour. Deliberately NO
 * search grounding here: identifying a label needs none, and combining
 * vision + a live search in one call made scans noticeably slower for no
 * benefit. Pricing is a separate, fast follow-up: the client calls
 * `findCheapestOffers(name)` (via `/api/price`) once it has the name, same as
 * the "recheck price" button elsewhere in the app.
 */
export async function extractBottleFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<BottleVision> {
  const prompt = `You are a whisky expert. Look at this photo of a bottle and identify the whisky.

Read the label to identify the exact bottle.

Return ONLY a JSON object (no prose) with this shape:
{
  "identified": true,
  "name": "full bottle name as marketed, e.g. 'Lagavulin 16 Year Old'",
  "distillery": "distillery or brand",
  "country": "country of origin",
  "region": "region if applicable (e.g. Islay, Speyside, Kentucky), else null",
  "category": "one of: ${CATEGORIES.join(" | ")}",
  "ageStatement": 16,
  "abv": 43.0,
  "flavorTags": ["3-6 short", "typical flavour", "notes"]
}

Rules:
- Base name, distillery, ageStatement and abv strictly on what is visible on the label.
- You MAY infer country, region and flavourTags from your knowledge of the identified bottle.
- "category" MUST be exactly one of the listed values, or null.
- Use null for anything you cannot read or confidently infer.
- If the image is not a whisky/spirits bottle, return {"identified": false}.`;

  const res = await client().models.generateContent({
    model: MODEL,
    contents: [
      { inlineData: { mimeType, data: imageBase64 } },
      { text: prompt },
    ],
    config: { temperature: 0.2 },
  });
  const text = res.text;
  if (!text) throw new Error("Empty response from Gemini.");

  const parsed = bottleVisionSchema.safeParse(extractJson(text));
  if (!parsed.success) throw new Error("Could not read bottle details from the photo.");
  return parsed.data;
}

export interface CompleteSetParams {
  target: string;
  targetType: "distillery" | "region";
  owned: string[]; // names the user already has in this set, don't re-suggest
  count?: number;
}

/**
 * Given a distillery or region, suggest the notable bottles that define that set
 * which the user does NOT already own, each buyable in the Netherlands with the
 * cheaper of Gall & Gall / Drankdozijn priced.
 */
export async function completeTheSet({
  target,
  targetType,
  owned,
  count = 8,
}: CompleteSetParams): Promise<Recommendation[]> {
  const ownedList = owned.length ? owned.map((n) => `- ${n}`).join("\n") : "none yet";
  const scope =
    targetType === "distillery"
      ? "core-range and iconic expressions from this distillery"
      : "iconic whiskies that define this region";

  const prompt = `You are a whisky expert helping someone in the Netherlands complete a set.

They want to complete the ${targetType}: "${target}".

Bottles from this ${targetType} they ALREADY own (do NOT suggest these again):
${ownedList}

Using Google Search, list up to ${count} ${scope} that they do NOT already own and that are realistically buyable in the Netherlands at one of: ${RETAILER_INLINE}. Prefer the bottles that most define the set. Check current availability and the cheapest price across these retailers.

Return ONLY a JSON array, no prose, of up to ${count} objects with this shape:
[{
  "name": "full bottle name",
  "distillery": "distillery or brand",
  "category": "single malt scotch | bourbon | rye | irish | japanese | world whisky | ...",
  "country": "country of origin",
  "abv": 43.0,
  "flavorProfile": "one short sentence on the taste",
  "reasoning": "one sentence on where it sits in the set / why it matters",
  "estPriceEur": 49.99,
  "retailer": "${RETAILER_ENUM_HINT}",
  "productUrl": "direct product link at the cheapest retailer"
}]
Only include bottles you can realistically find in NL. Use null for anything you cannot determine. Prefer 70cl bottles. Pick the cheapest retailer for estPriceEur/retailer/productUrl.`;

  const text = await grounded(prompt);
  const parsed = z.array(recommendationSchema).safeParse(extractJson(text));
  if (!parsed.success) throw new Error("Could not parse the set from Gemini.");
  return parsed.data;
}

export interface BuildFlightParams {
  bottles: Bottle[]; // the user's OWN bottles: the flight is curated from these only
  theme?: string;
  count?: number;
}

/**
 * Curate a themed tasting flight from the user's own bottles. Unlike discovery,
 * this needs no external facts. It only orders and annotates bottles the user
 * already owns, so we call the model WITHOUT the Google Search tool (cheaper,
 * faster, and it can't hallucinate bottles: it must pick from the numbered list).
 * The returned `steps[].index` are 1-based positions in that list.
 */
export async function buildTastingFlight({
  bottles,
  theme,
  count = 4,
}: BuildFlightParams): Promise<FlightBuildResult> {
  const { prompt } = buildTastingFlightPrompt(bottles, theme, count);

  const res = await client().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { temperature: 0.8 },
  });
  const text = res.text;
  if (!text) throw new Error("Empty response from Gemini.");

  return parseFlightBuildResult(text);
}
