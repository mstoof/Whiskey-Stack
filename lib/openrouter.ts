import {
  recommendationSchema,
  priceOfferSchema,
  bottleVisionSchema,
  CATEGORIES,
  NL_RETAILERS,
  type Recommendation,
  type PriceOffer,
  type BottleVision,
  type FlightBuildResult,
} from "./types";
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
import type { DiscoverParams, CompleteSetParams, BuildFlightParams } from "./gemini";

/**
 * OpenRouter (openrouter.ai): a single OpenAI-compatible API in front of many
 * models, including free-tier ones (`:free` model IDs). Used as a fallback for
 * (or, with no GEMINI_API_KEY, a replacement for) Gemini when its quota is hit.
 * See lib/ai.ts for the routing logic.
 *
 * Unlike Gemini, there's no bundled Google Search grounding here: OpenRouter's
 * "web" plugin can add search to any model, but it costs money even on free
 * models (OPENROUTER_ENABLE_WEB opts in). Without it, we do NOT ask the model
 * to guess a price: that would violate this app's own rule that we only ever
 * claim a price we actually found. So on the free path, recommendations/vision
 * come back with name/taste/reasoning but a null price (same shape the UI
 * already renders gracefully), and findCheapestOffers (whose entire job IS
 * pricing) just returns no offers.
 */

/** Free-model rosters on OpenRouter rotate constantly, so there's no hardcoded default.
 * Pick a current one at https://openrouter.ai/models?max_price=0 and set it. */
const MODEL = process.env.OPENROUTER_MODEL;
const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || MODEL;
const WEB_SEARCH_ENABLED = process.env.OPENROUTER_ENABLE_WEB === "true";

export class OpenRouterNotConfiguredError extends Error {
  constructor() {
    super(
      "OpenRouter isn't configured. Set OPENROUTER_API_KEY and OPENROUTER_MODEL " +
        "(pick a current model, e.g. a free one, at https://openrouter.ai/models?max_price=0).",
    );
    this.name = "OpenRouterNotConfiguredError";
  }
}

/** Both an API key AND a model must be set. Never fall back to a guessed model ID. */
export function openRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY && MODEL);
}

interface ChatOpts {
  temperature?: number;
  image?: { mimeType: string; base64: string };
  /** Attach the web-search plugin for this call, if OPENROUTER_ENABLE_WEB is on. */
  web?: boolean;
}

async function chat(prompt: string, model: string | undefined, opts: ChatOpts = {}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || !model) throw new OpenRouterNotConfiguredError();

  const message = opts.image
    ? {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${opts.image.mimeType};base64,${opts.image.base64}` } },
        ],
      }
    : { role: "user", content: prompt };

  const body: Record<string, unknown> = {
    model,
    messages: [message],
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.web && WEB_SEARCH_ENABLED) {
    // Restrict to the retailers we actually care about and cap result count.
    // Every prompt that sets `web` is only ever checking these 4 domains, so
    // an open-web search is both slower (more pages to fetch/rank) and less
    // relevant than one scoped straight to them.
    body.plugins = [
      {
        id: "web",
        max_results: 4,
        include_domains: NL_RETAILERS.map((r) => r.site),
      },
    ];
  }

  // Bound worst-case latency: fail with a clear timeout error rather than
  // hang until the route's own maxDuration cuts it off.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://github.com/",
        "X-Title": "Whiskey Stack",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("OpenRouter request timed out after 45s.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenRouter.");
  return text;
}

/** How the pricing instruction reads, depending on whether search grounding is on. */
function pricingInstruction(): string {
  return WEB_SEARCH_ENABLED
    ? `Every bottle MUST be realistically purchasable in the Netherlands at one of: ${RETAILER_INLINE}. Use web search to check current availability and the cheapest price across these retailers.`
    : `You do NOT have live web access for this request, so do not guess a price. Leave "estPriceEur", "retailer" and "productUrl" as null for every bottle. Still make sure each bottle is realistically sold in the Netherlands.`;
}

export async function discoverWhiskeys({
  bottles,
  preferences,
  count = 6,
}: DiscoverParams): Promise<Recommendation[]> {
  const prompt = `You are a knowledgeable whisky buyer for someone in the Netherlands.

Their current collection:
${collectionSummary(bottles)}

Extra preferences for this search: ${preferences?.trim() || "none given, surprise them, but broaden the collection sensibly."}

Recommend ${count} DIFFERENT bottles they do NOT already own that would expand their collection in an interesting way (new regions, styles, distilleries, or flavour profiles they are missing). ${pricingInstruction()}

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
Use null for anything you genuinely cannot determine. Prefer 70cl bottles.`;

  const text = await chat(prompt, MODEL, { temperature: 0.7, web: true });
  const parsed = z.array(recommendationSchema).safeParse(extractJson(text));
  if (!parsed.success) throw new Error("Could not parse recommendations from the model.");
  return parsed.data;
}

export async function findCheapestOffers(bottleName: string): Promise<PriceOffer[]> {
  if (!WEB_SEARCH_ENABLED) {
    // This function's entire job is pricing. Without the (paid) search
    // plugin there's no live data to give, so an honest empty result beats
    // a guessed price. Set OPENROUTER_ENABLE_WEB=true to enable it for real.
    return [];
  }

  const prompt = `Using web search, find the current price of the whisky "${bottleName}" at these Dutch retailers:
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

  const text = await chat(prompt, MODEL, { temperature: 0.3, web: true });
  const parsed = z.array(priceOfferSchema).safeParse(extractJson(text));
  if (!parsed.success) throw new Error("Could not parse price offers from the model.");
  return parsed.data
    .filter((o) => o.priceEur != null)
    .sort((a, b) => (a.priceEur ?? Infinity) - (b.priceEur ?? Infinity));
}

/**
 * Deliberately no `web` search here (regardless of OPENROUTER_ENABLE_WEB):
 * reading a label needs none, and combining vision + search in one call was
 * the main source of slow scans. Pricing is a separate, fast follow-up: the
 * client calls `findCheapestOffers(name)` (via `/api/price`) once it has the
 * name, same as the "recheck price" button elsewhere in the app.
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

  const text = await chat(prompt, VISION_MODEL, {
    temperature: 0.2,
    image: { mimeType, base64: imageBase64 },
  });
  const parsed = bottleVisionSchema.safeParse(extractJson(text));
  if (!parsed.success) throw new Error("Could not read bottle details from the photo.");
  return parsed.data;
}

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

List up to ${count} ${scope} that they do NOT already own. ${pricingInstruction()}

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
Use null for anything you cannot determine. Prefer 70cl bottles.`;

  const text = await chat(prompt, MODEL, { temperature: 0.7, web: true });
  const parsed = z.array(recommendationSchema).safeParse(extractJson(text));
  if (!parsed.success) throw new Error("Could not parse the set from the model.");
  return parsed.data;
}

export async function buildTastingFlight({
  bottles,
  theme,
  count = 4,
}: BuildFlightParams): Promise<FlightBuildResult> {
  const { prompt } = buildTastingFlightPrompt(bottles, theme, count);
  const text = await chat(prompt, MODEL, { temperature: 0.8 });
  return parseFlightBuildResult(text);
}
