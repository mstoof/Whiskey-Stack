import { neon } from '@neondatabase/serverless';
import { purchasableOffers } from '../lib/prices.ts';

const userId = '4ab01c85-07a5-4dbc-a910-dde30a8ef06a';
const offers = [
  ['Glenfiddich Reserva Rum Cask', 163.95, 'Whisky.nl', 'https://whisky.nl/glenfiddich-21-years-rum-cask-finish-70cl.html'],
  ['Hibiki', 649.95, 'WhiskyXL', 'https://whiskyxl.nl/nl/222-hibiki'],
  ['Highland Park', 599.95, 'WhiskyXL', 'https://whiskyxl.nl/en/whisky/1450-highland-park-25-years-70cl.html'],
  ['Redbreast Reserve', 199.95, 'Gevo Slijterij', 'https://gevoslijterij.nl/whisky/irish/featured-brands/redbreast.html'],
  ['Rampur Indian Single Malt', 97.99, 'Wijnhuis Rhoon', 'https://wijnhuisrhoon.nl/categorie/single-malt/'],
  ['Paul John Brilliance', 43.39, 'Drankenshop Broekmans', 'https://nl.broekmans.be/nl/shop/product/whisky/1587/paul-john-brilliance'],
  ['Waterford Biodynamic Luna', 87.95, 'De Groene Slijter', 'https://degroeneslijter.nl/product/waterford-irish-single-malt-whisky-biodynamic-luna-1-1/'],
  ['Westland Garryana', 155, 'Whiskykoning', 'https://whiskykoning.nl/product/westland-garryana-7th-edition/'],
  ['Springbank', 495, 'Whiskybase Shop', 'https://shop.whiskybase.com/nl/springbank-21-year-old-145875376.html'],
  ['The Balvenie PortWood', 244.95, 'WhiskyXL', 'https://whiskyxl.nl/nl/whisky/317-balvenie-21-years-portwood-70cl.html'],
  ['Milk & Honey Apex Dead Sea', 117, 'Van Eccelpoel', 'https://www.vaneccelpoelwijnen.be/milkandhoney-apex-dead-sea-562-70cl.html'],
].map(([name, priceEur, retailer, productUrl]) => ({ name, priceEur, retailer, productUrl, volumeMl: 700, note: 'In stock when checked' }));
if (purchasableOffers(offers).length !== offers.length) throw new Error('Offer validation failed');
const sql = neon(process.env.DATABASE_URL);
const result = await sql.transaction(offers.map((o) => sql`
  update bottles set last_checked_price_eur=${String(o.priceEur)}, last_checked_retailer=${o.retailer}, last_checked_url=${o.productUrl}, last_checked_at=now(), updated_at=now()
  where user_id=${userId} and status='wishlist' and name=${o.name} returning name
`));
const saved = await sql`select count(*)::int as count from bottles where user_id=${userId} and status='wishlist' and last_checked_price_eur is not null`;
console.log({ updated: result.flat().length, savedPrices: saved[0].count });
