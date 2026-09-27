import type { Bottle } from "./schema";
import { NL_RETAILERS, flightBuildResultSchema, type FlightBuildResult } from "./types";

/**
 * Provider-agnostic helpers shared by lib/gemini.ts and lib/openrouter.ts, and
 * consumed by the lib/ai.ts fallback router. Kept dependency-free of either
 * provider's SDK/fetch code so both can import it without a cycle.
 */

/** Pull the first JSON array/object out of a model response that may be fenced. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  // Find the outermost array or object.
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in model response.");
  const open = candidate[start];
  const close = open === "[" ? "]" : "}";
  const end = candidate.lastIndexOf(close);
  const slice = candidate.slice(start, end + 1);
  return JSON.parse(slice);
}

/**
 * Best-effort detection of a provider rate-limit/quota error. Gemini's 429s
 * and OpenRouter's proxied 429s both surface as an Error whose message
 * contains one of these. Used by the price-watch cron (Gemini-only) and by
 * lib/ai.ts (to decide whether to fall back from Gemini to OpenRouter).
 */
export function isRateLimited(err: unknown): boolean {
  const s = err instanceof Error ? err.message : String(err);
  return /429|RESOURCE_EXHAUSTED|rate.?limit/i.test(s);
}

/** Render the user's owned/finished bottles as a short bulleted summary for a prompt. */
export function collectionSummary(bottles: Bottle[]): string {
  const owned = bottles.filter((b) => b.status !== "wishlist");
  if (owned.length === 0) return "The collection is currently empty.";
  const lines = owned.slice(0, 60).map((b) => {
    const bits = [b.name];
    if (b.category) bits.push(b.category);
    if (b.country) bits.push(b.country);
    if (b.rating != null) bits.push(`rated ${b.rating}/100`);
    const tags = (b.flavorTags ?? []).slice(0, 4).join(", ");
    if (tags) bits.push(`notes: ${tags}`);
    return `- ${bits.join(" · ")}`;
  });
  return lines.join("\n");
}

/** "Gall & Gall (gall.nl), Drankdozijn (drankdozijn.nl), ...": for inline prompt text. */
export const RETAILER_INLINE = NL_RETAILERS.map((r) => `${r.name} (${r.site})`).join(", ");
/** "- Gall & Gall (gall.nl)\n- Drankdozijn (drankdozijn.nl)\n...": for bulleted prompt text. */
export const RETAILER_BULLETS = NL_RETAILERS.map((r) => `- ${r.name} (${r.site})`).join("\n");
/** "Gall & Gall | Drankdozijn | ...": for JSON-shape field docs in prompts. */
export const RETAILER_ENUM_HINT = NL_RETAILERS.map((r) => r.name).join(" | ");

/**
 * Shared prompt for "suggest a tasting flight", identical for every provider,
 * since it needs no live grounding, only the user's own bottles (it can't
 * hallucinate bottles: the model must pick numbers from this list). Returns
 * the prompt plus how many pours were actually requested (clamped).
 */
export function buildTastingFlightPrompt(
  bottles: Bottle[],
  theme: string | undefined,
  count: number,
): { prompt: string; pick: number } {
  const owned = bottles.filter((b) => b.status !== "wishlist");
  if (owned.length < 2) {
    throw new Error("Need at least two owned bottles to build a flight.");
  }
  const numbered = owned
    .map((b, i) => {
      const bits = [b.name];
      if (b.category) bits.push(b.category);
      if (b.country) bits.push(b.country);
      if (b.abv != null) bits.push(`${b.abv}% ABV`);
      const tags = (b.flavorTags ?? []).slice(0, 5).join(", ");
      if (tags) bits.push(`notes: ${tags}`);
      return `${i + 1}. ${bits.join(" · ")}`;
    })
    .join("\n");

  const pick = Math.min(count, owned.length);
  const themeLine = theme?.trim()
    ? `Theme to build around: "${theme.trim()}".`
    : "Choose a fun, coherent theme yourself (e.g. a regional journey, a peat progression, a sherried night).";

  const prompt = `You are a whisky host planning a tasting flight from bottles someone ALREADY owns.

Their owned bottles (numbered):
${numbered}

${themeLine}

Pick ${pick} bottles from ONLY the numbered list above (use their exact numbers). Order them into a good tasting progression, generally lightest/most delicate to boldest/peatiest, unless the theme dictates another order. For each pour, write one short sentence on what to notice and why it sits where it does in the flight.

Return ONLY a JSON object (no prose) with this shape:
{
  "title": "a short evocative flight title",
  "theme": "one short phrase describing the theme",
  "steps": [
    { "index": 3, "note": "why this pour, one sentence" },
    { "index": 1, "note": "..." }
  ]
}
Only use index numbers that appear in the list. Do not invent bottles. Order "steps" in the intended tasting order.`;

  return { prompt, pick };
}

/** Validate a model's flight-build response against the shared schema. */
export function parseFlightBuildResult(text: string): FlightBuildResult {
  const parsed = flightBuildResultSchema.safeParse(extractJson(text));
  if (!parsed.success) throw new Error("Could not parse the flight from the model.");
  return parsed.data;
}
