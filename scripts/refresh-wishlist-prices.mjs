import { neon } from '@neondatabase/serverless';
import { findCheapestOffers } from '../lib/ai.ts';
import { purchasableOffers } from '../lib/prices.ts';

const userId = '4ab01c85-07a5-4dbc-a910-dde30a8ef06a';
const sql = neon(process.env.DATABASE_URL);
const bottles = await sql`select id,name from bottles where user_id=${userId} and status='wishlist' order by name`;
let refreshed = 0;
let unavailable = 0;
let stopped = false;
for (const bottle of bottles) {
  if (stopped) { unavailable++; continue; }
  try {
    const offers = purchasableOffers(await findCheapestOffers(bottle.name));
    const cheapest = offers[0];
    if (!cheapest) { unavailable++; continue; }
    await sql`update bottles set last_checked_price_eur=${String(cheapest.priceEur)}, last_checked_retailer=${cheapest.retailer}, last_checked_url=${cheapest.productUrl}, last_checked_at=now(), updated_at=now() where user_id=${userId} and id=${bottle.id} and status='wishlist'`;
    refreshed++;
    console.log(`priced: ${bottle.name} €${cheapest.priceEur.toFixed(2)} at ${cheapest.retailer}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`provider stopped at ${bottle.name}: ${message.slice(0, 180)}`);
    stopped = true;
    unavailable++;
  }
}
const priced = await sql`select count(*)::int as count from bottles where user_id=${userId} and status='wishlist' and last_checked_price_eur is not null`;
console.log(JSON.stringify({ total: bottles.length, refreshed, unavailable, savedPrices: priced[0].count }));
