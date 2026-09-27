import { neon } from '@neondatabase/serverless';

const userId = '4ab01c85-07a5-4dbc-a910-dde30a8ef06a';
const renames = {
  'Arran 10 Year Old': 'Arran',
  'Bunnahabhain 12 Year Old': 'Bunnahabhain',
  'Johnnie Walker Black Label 12 Year Old': 'Johnnie Walker Black Label',
  'Redbreast 12 Year Old': 'Redbreast',
  'Redbreast 21 Year Old': 'Redbreast Reserve',
  'Glenfiddich 21 Year Old Reserva Rum Cask': 'Glenfiddich Reserva Rum Cask',
  'Hibiki 21 Year Old': 'Hibiki',
  'Highland Park 25 Year Old': 'Highland Park',
  'Lagavulin 25 Year Old': 'Lagavulin',
  'Springbank 21 Year Old': 'Springbank',
  'The Balvenie 21 Year Old PortWood': 'The Balvenie PortWood',
  'The Macallan 18 Year Old Sherry Oak': 'The Macallan Sherry Oak',
  'Yamazaki 18 Year Old': 'Yamazaki',
};
const images = {
  'Dalmore King Alexander III': 'https://www.thedalmore.com/media/wafjxsu5/large-kaiii_2023_us_750_front-bottle_no-shadow.png?height=1200&v=1dc4811fe9e3fa0&width=960',
  'Glenfiddich Reserva Rum Cask': 'https://mrliquor.com.au/cdn/shop/products/Glenfiddich_21_Year_Old_700mL_Tube-1_1200x1200.jpg?v=1573617641',
  Hibiki: 'https://jamesfox.ie/cdn/shop/files/hibiki-21.jpg?v=1762520964',
  'Highland Park': 'https://www.highlandparkwhisky.com/sites/highlandpark/files/styles/portrait_4_5/public/HPK-25YO.jpg?itok=Hdax4WoH',
  Lagavulin: 'https://www.lochfynewhiskies.com/media/catalog/product/l/a/lagavulin-25yo.jpg?image-type=image&store=lfw_view&width=829',
  'Mackmyra Svensk Rök': 'https://whisky.nl/media/catalog/product/m/a/mackmyra-svensk-rok-50cl.jpg?height=1400&image-type=image&store=whisky_nl&width=1400',
  'Milk & Honey Apex Dead Sea': 'https://www.whiskybrother.com/cdn/shop/products/milk-and-honey-apex-dead-sea.jpg?v=1637615123',
  'Paul John Brilliance': 'https://cdn11.bigcommerce.com/s-e8lbekfe7c/product_images/attribute_rule_images/31851_source_1773153045.jpg',
  'Rampur Indian Single Malt': 'https://cdn11.bigcommerce.com/s-e8lbekfe7c/images/stencil/3840w/attribute_rule_images/20475_source_1758883351.jpg?compression=lossy',
  'Redbreast Reserve': 'https://www.whiskybrother.com/cdn/shop/files/Redbreast-21yo_54ca1fd4-b40b-4428-857e-dfaa04c1d992.jpg?v=1747761566',
  Springbank: 'https://www.whiskybrother.com/cdn/shop/files/springbank-21yo_4ceb46d2-52e0-4389-98b3-3cb4563ff433.jpg?v=1697624729',
  'The Balvenie PortWood': 'https://www.enoteca.com.lb/cdn/shop/files/Scotch-Whisky_balvenie-21-years.webp?v=1755597392&width=1946',
  'The Macallan Sherry Oak': 'https://maltco.vn/media/catalog/product/cache/e23dd0f7bd71f6870bbc835b86d5d59e/r/_/r_u_the_macallan_18_sherry_oak_1_.webp',
  'Waterford Biodynamic Luna': 'https://cdn.shopify.com/s/files/1/0257/6577/3386/products/waterford-luna_bb28245c-e941-4502-9810-73342d6aa61b.png?v=1683094247',
  'Westland Garryana': 'https://qualityliquorstore.com/cdn/shop/files/westland-garryana-whiskey.jpg?v=1765205684&width=1000',
  Yamazaki: 'https://assets.theblend.world/images/2019-09/Japanese_bottle_Yamazaki_18.png',
};
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`select name from bottles where user_id=${userId} and status='wishlist'`;
const renamed = new Set();
for (const row of rows) {
  const next = renames[row.name] ?? row.name;
  const image = images[next] ?? null;
  if (next !== row.name) {
    const conflict = await sql`select id from bottles where user_id=${userId} and status='wishlist' and name=${next}`;
    if (conflict.length) throw new Error(`Rename conflict: ${row.name} -> ${next}`);
  }
  await sql`update bottles set name=${next}, image_url=coalesce(${image}, image_url), updated_at=now()
    where user_id=${userId} and status='wishlist' and name=${row.name}`;
  if (next !== row.name) renamed.add(`${row.name} -> ${next}`);
}
const check = await sql`select count(*)::int as total, count(image_url)::int as images from bottles where user_id=${userId} and status='wishlist'`;
console.log({ renamed: renamed.size, images: check[0] });
