import { neon } from '@neondatabase/serverless';

const userId = '4ab01c85-07a5-4dbc-a910-dde30a8ef06a';
const special = {
  'Unique choices': [
    ['Stauning R.Y.E.', 'Stauning', 'Denmark', 'Jutland', 'rye', 'A distinctive Danish rye made with local grain.'],
    ['Amrut Fusion', 'Amrut', 'India', 'Bangalore', 'world whisky', 'A warm, tropical Indian single malt with a split barley style.'],
    ['Kavalan Concertmaster Port Cask Finish', 'Kavalan', 'Taiwan', 'Yilan', 'world whisky', 'A fruit-forward Taiwanese malt with a port-cask finish.'],
    ['Starward Two-Fold', 'Starward', 'Australia', 'Victoria', 'world whisky', 'An approachable Australian blend shaped by red-wine casks.'],
    ['Mackmyra Svensk Rök', 'Mackmyra', 'Sweden', 'Gävle', 'world whisky', 'A Swedish smoky malt with juniper and Nordic character.'],
    ['Waterford Biodynamic Luna', 'Waterford', 'Ireland', 'County Waterford', 'irish', 'A terroir-led Irish whisky made from biodynamic barley.'],
    ['Milk & Honey Apex Dead Sea', 'Milk & Honey', 'Israel', 'Tel Aviv', 'world whisky', 'A hot-climate Israeli single malt with a saline edge.'],
    ['Rampur Indian Single Malt', 'Rampur', 'India', 'Uttar Pradesh', 'world whisky', 'A soft, fruit-led Indian malt aged in the Himalayan foothills.'],
    ['Paul John Brilliance', 'Paul John', 'India', 'Goa', 'world whisky', 'A bright, unpeated Goa malt with tropical fruit and spice.'],
    ['Westland Garryana', 'Westland', 'United States', 'Washington', 'single malt scotch', 'A Pacific Northwest malt matured with local Garry oak.'],
  ],
  "Luxury Whisky's": [
    ['The Macallan 18 Year Old Sherry Oak', 'The Macallan', 'Scotland', 'Speyside', 'single malt scotch', 'A classic luxury sherry-matured Speyside benchmark.'],
    ['Yamazaki 18 Year Old', 'Yamazaki', 'Japan', 'Osaka', 'japanese', 'A rare Japanese single malt with deep fruit and incense notes.'],
    ['Hibiki 21 Year Old', 'Suntory', 'Japan', 'Japan', 'japanese', 'An elegant aged blend known for balance, fruit, and silkiness.'],
    ['Glenfiddich 21 Year Old Reserva Rum Cask', 'Glenfiddich', 'Scotland', 'Speyside', 'single malt scotch', 'A polished Speyside malt finished in Caribbean rum casks.'],
    ['The Balvenie 21 Year Old PortWood', 'The Balvenie', 'Scotland', 'Speyside', 'single malt scotch', 'Honeyed, layered Speyside whisky with a port finish.'],
    ['Lagavulin 25 Year Old', 'Lagavulin', 'Scotland', 'Islay', 'single malt scotch', 'A rare, deeply smoky Islay whisky for a special pour.'],
    ['Springbank 21 Year Old', 'Springbank', 'Scotland', 'Campbeltown', 'single malt scotch', 'A sought-after Campbeltown malt with coastal complexity.'],
    ['Redbreast 21 Year Old', 'Redbreast', 'Ireland', 'County Cork', 'irish', 'A richly layered Irish pot still whisky with orchard fruit.'],
    ['Dalmore King Alexander III', 'The Dalmore', 'Scotland', 'Highlands', 'single malt scotch', 'A cask-finished Highland whisky designed for slow sipping.'],
    ['Highland Park 25 Year Old', 'Highland Park', 'Scotland', 'Orkney', 'single malt scotch', 'An elegant Orkney malt balancing gentle smoke and dried fruit.'],
  ],
};
const sql = neon(process.env.DATABASE_URL);
const existing = await sql`select name from bottles where user_id=${userId}`;
const names = new Set(existing.map((b) => b.name.trim().toLowerCase()));
let added = 0;
for (const [category, rows] of Object.entries(special)) {
  for (const [name, distillery, country, region, baseCategory, notes] of rows) {
    if (names.has(name.toLowerCase())) {
      await sql`update bottles set category=${category}, notes=${notes}, updated_at=now()
        where user_id=${userId} and status='wishlist' and lower(trim(name))=${name.toLowerCase()}`;
      continue;
    }
    await sql`insert into bottles (user_id,name,distillery,country,region,category,status,flavor_tags,notes)
      values (${userId},${name},${distillery},${country},${region},${category},'wishlist',${JSON.stringify([baseCategory])}::jsonb,${notes})`;
    names.add(name.toLowerCase());
    added++;
  }
}
const counts = await sql`select category,count(*)::int as count from bottles where user_id=${userId} and status='wishlist' and category in ('Unique choices',${"Luxury Whisky's"}) group by category order by category`;
console.log(JSON.stringify({ added, counts }));
