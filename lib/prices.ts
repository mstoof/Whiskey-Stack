import { NL_RETAILERS, type PriceOffer } from "./types";

export function retailerUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return NL_RETAILERS.some(({ site }) => url.hostname === site || url.hostname.endsWith(`.${site}`)) ? url.href : null;
  } catch {
    return null;
  }
}

/** Compare available standard bottles, excluding membership-only offers. */
export function purchasableOffers(offers: PriceOffer[]): PriceOffer[] {
  return offers.filter((o) =>
    typeof o.priceEur === "number" && Number.isFinite(o.priceEur) && o.priceEur > 0 &&
    o.volumeMl === 700 && retailerUrl(o.productUrl) !== null &&
    !/out of stock|sold out|unavailable|niet op voorraad|uitverkocht|premium|member|membership|leden/i.test(o.note ?? "")
  ).sort((a, b) => a.priceEur! - b.priceEur!);
}
