import * as gemini from "./gemini";
import * as openrouter from "./openrouter";
import { isRateLimited } from "./aiShared";
import type { DiscoverParams, CompleteSetParams, BuildFlightParams } from "./gemini";
import type { Recommendation, PriceOffer, BottleVision, FlightBuildResult } from "./types";

/**
 * Fallback router in front of the two AI providers. Every API route should
 * import from HERE, not from lib/gemini.ts or lib/openrouter.ts directly.
 * The one exception is the price-watch cron (app/api/cron/price-watch), which
 * deliberately stays Gemini-only: its "stop early on a 429" behavior exists
 * to preserve Gemini quota across days, and mixing in OpenRouter's much
 * smaller free-tier quota there would undercut the interactive fallback below
 * for no real benefit (a skipped cron bottle just gets retried tomorrow).
 *
 * Strategy: try Gemini first (it has real Google Search grounding, so its
 * pricing is trustworthy); if Gemini is rate-limited AND OpenRouter is
 * configured, fall back to OpenRouter transparently. If Gemini isn't
 * configured at all, go straight to OpenRouter. Throws AiNotConfiguredError
 * if neither is set up.
 *
 * After a 429, Gemini goes on a short cooldown (skipped entirely, straight to
 * OpenRouter) so we're not burning a full round-trip on a call that's almost
 * certain to fail again. See GEMINI_COOLDOWN_MS below.
 */

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "No AI provider configured. Set GEMINI_API_KEY, or OPENROUTER_API_KEY " +
        "+ OPENROUTER_MODEL, to enable AI features.",
    );
    this.name = "AiNotConfiguredError";
  }
}

function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** True if either provider can currently serve a request. Drives the `aiEnabled` UI gate. */
export function isAiConfigured(): boolean {
  return geminiConfigured() || openrouter.openRouterConfigured();
}

/**
 * How long to skip Gemini entirely (going straight to OpenRouter) after it
 * 429s, instead of wasting a full round-trip on a call that's almost
 * certainly going to fail again while the quota is still exhausted. Gemini's
 * free-tier quota resets daily, but we don't track the exact reset time. A
 * short rolling cooldown is a simpler, safe heuristic (worst case: we retry
 * Gemini a bit sooner than strictly necessary). Module-level, so it resets on
 * a cold start/restart, which is fine since it's purely a latency optimization, not
 * a correctness guard.
 */
const GEMINI_COOLDOWN_MS = 5 * 60 * 1000;
let geminiRateLimitedUntil = 0;

async function withFallback<A extends unknown[], R>(
  label: string,
  args: A,
  geminiFn: (...args: A) => Promise<R>,
  openrouterFn: (...args: A) => Promise<R>,
): Promise<R> {
  const canOpenRouter = openrouter.openRouterConfigured();
  const skipGemini = canOpenRouter && Date.now() < geminiRateLimitedUntil;

  if (geminiConfigured() && !skipGemini) {
    try {
      return await geminiFn(...args);
    } catch (err) {
      if (isRateLimited(err)) {
        geminiRateLimitedUntil = Date.now() + GEMINI_COOLDOWN_MS;
        if (canOpenRouter) {
          console.warn(
            `ai: Gemini rate-limited on ${label}, falling back to OpenRouter ` +
              `(skipping Gemini for the next ${GEMINI_COOLDOWN_MS / 1000}s).`,
          );
          return await openrouterFn(...args);
        }
      }
      throw err;
    }
  }

  if (canOpenRouter) {
    if (skipGemini) console.warn(`ai: Gemini on cooldown, using OpenRouter directly for ${label}.`);
    return await openrouterFn(...args);
  }
  throw new AiNotConfiguredError();
}

export function discoverWhiskeys(params: DiscoverParams): Promise<Recommendation[]> {
  return withFallback("discoverWhiskeys", [params], gemini.discoverWhiskeys, openrouter.discoverWhiskeys);
}

export function findCheapestOffers(bottleName: string): Promise<PriceOffer[]> {
  return withFallback("findCheapestOffers", [bottleName], gemini.findCheapestOffers, openrouter.findCheapestOffers);
}

export function extractBottleFromImage(imageBase64: string, mimeType: string): Promise<BottleVision> {
  return withFallback(
    "extractBottleFromImage",
    [imageBase64, mimeType],
    gemini.extractBottleFromImage,
    openrouter.extractBottleFromImage,
  );
}

export function completeTheSet(params: CompleteSetParams): Promise<Recommendation[]> {
  return withFallback("completeTheSet", [params], gemini.completeTheSet, openrouter.completeTheSet);
}

export function buildTastingFlight(params: BuildFlightParams): Promise<FlightBuildResult> {
  return withFallback("buildTastingFlight", [params], gemini.buildTastingFlight, openrouter.buildTastingFlight);
}
