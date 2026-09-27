import assert from "node:assert/strict";
import test from "node:test";
import { purchasableOffers, retailerUrl } from "./prices";

const offer = { retailer: "Drankdozijn", priceEur: 30, volumeMl: 700, productUrl: "https://drankdozijn.nl/artikel/bottle" };

test("compares like-sized available offers and sorts cheapest first", () => {
  const valid = { ...offer, priceEur: 25 };
  assert.deepEqual(purchasableOffers([
    offer, { ...offer, priceEur: 5, volumeMl: 50 }, { ...offer, priceEur: 10, note: "out of stock" },
    { ...offer, priceEur: 20, note: "Premium members only" }, { ...offer, priceEur: -5 },
    { ...offer, priceEur: NaN }, { ...offer, priceEur: null }, { ...offer, volumeMl: null },
    { ...offer, productUrl: "javascript:alert(1)" }, valid,
  ]), [valid, offer]);
});

test("only trusted HTTPS retailer links become buy buttons", () => {
  assert.equal(retailerUrl("https://www.gall.nl/product.html"), "https://www.gall.nl/product.html");
  for (const value of [null, "bad", "http://gall.nl", "https://gall.nl.evil.example/x", "https://user:pass@gall.nl/x", "javascript:alert(1)"]) {
    assert.equal(retailerUrl(value), null);
  }
});
