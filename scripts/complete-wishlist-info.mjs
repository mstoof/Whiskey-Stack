import { neon } from '@neondatabase/serverless';

const userId = '4ab01c85-07a5-4dbc-a910-dde30a8ef06a';
const details = {
  'Dalmore King Alexander III': ['A luxurious Highland single malt finished in several cask types, bringing orange, spice, chocolate and dried fruit.', 219.49, 'Drankdozijn', 'https://drankdozijn.nl/merk/dalmore'],
  'The Macallan 18 Year Old Sherry Oak': ['A prestigious Speyside single malt matured in sherry-seasoned oak, with dried fruit, ginger, vanilla and cinnamon.', 349.95, 'Drankdozijn', 'https://drankdozijn.nl/artikel/fles-the-macallan-18-years-sherry-oak-70cl'],
  'Yamazaki 18 Year Old': ['A rare Japanese single malt with layered dried fruit, Mizunara spice and a long, incense-like finish.', 569.95, 'Drankdozijn', 'https://drankdozijn.nl/groep/whisky/japan'],
  'Glenfiddich 21 Year Old Reserva Rum Cask': ['A mature Speyside single malt finished in Caribbean rum casks, combining oak, vanilla, toffee and tropical fruit.', null, null, null],
  'Hibiki 21 Year Old': ['An elegant aged Japanese blend with orchard fruit, honey, sandalwood and a long, polished finish.', null, null, null],
  'Highland Park 25 Year Old': ['A rare Orkney single malt balancing gentle peat smoke, dried fruit, honey and coastal spice.', null, null, null],
  'Lagavulin 25 Year Old': ['A rare long-aged Islay whisky with deep peat smoke, dried fruit, oak and a slow, warming finish.', null, null, null],
  'Redbreast 21 Year Old': ['A richly layered Irish single pot still whiskey with orchard fruit, nuts, baking spice and toasted oak.', null, null, null],
  'Springbank 21 Year Old': ['A sought-after Campbeltown single malt with maritime character, fruit, light smoke and complex oak.', null, null, null],
  'The Balvenie 21 Year Old PortWood': ['A honeyed Speyside malt finished in port casks, adding dried fruit, nuts, vanilla and gentle spice.', null, null, null],
  'Mackmyra Svensk Rök': ['A Swedish single malt with soft peat smoke, juniper, vanilla and a distinctly Nordic character.', null, null, null],
  'Milk & Honey Apex Dead Sea': ['An Israeli single malt shaped by hot maturation near the Dead Sea, with dried fruit, spice and a saline edge.', null, null, null],
  'Paul John Brilliance': ['A bright Indian single malt from Goa with tropical fruit, honey, vanilla and warming spice.', null, null, null],
  'Rampur Indian Single Malt': ['A smooth Indian single malt from the Himalayan foothills, showing orchard fruit, vanilla and gentle oak.', null, null, null],
  'Waterford Biodynamic Luna': ['A terroir-led Irish single malt made from biodynamic barley, with cereal sweetness, fruit and mineral notes.', null, null, null],
  'Westland Garryana': ['A Pacific Northwest single malt matured with local Garry oak, bringing cocoa, toasted wood and dark fruit.', null, null, null],
};
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`select name from bottles where user_id=${userId} and status='wishlist'`;
const updated = [];
for (const row of rows) {
  const d = details[row.name];
  if (!d) continue;
  const [description, price, retailer, url] = d;
  const result = await sql`update bottles set description_en=${description}, description_nl=${description},
    last_checked_price_eur=${price == null ? null : String(price)}, last_checked_retailer=${retailer}, last_checked_url=${url}, last_checked_at=${price == null ? null : new Date()}, updated_at=now()
    where user_id=${userId} and status='wishlist' and name=${row.name} returning name`;
  updated.push(...result);
}
console.log({ updated: updated.length, pricesAdded: Object.values(details).filter((d) => d[1] != null).length });
