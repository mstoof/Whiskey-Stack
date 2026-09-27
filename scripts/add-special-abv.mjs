import { neon } from '@neondatabase/serverless';

const userId = '4ab01c85-07a5-4dbc-a910-dde30a8ef06a';
const abv = {
  'Stauning R.Y.E.': 48, 'Amrut Fusion': 50, 'Kavalan Concertmaster Port Cask Finish': 40,
  'Starward Two-Fold': 40, 'Mackmyra Svensk Rök': 46.1, 'Waterford Biodynamic Luna': 50,
  'Milk & Honey Apex Dead Sea': 56.2, 'Rampur Indian Single Malt': 43, 'Paul John Brilliance': 46,
  'Westland Garryana': 50, 'The Macallan Sherry Oak': 43, 'Yamazaki': 43, 'Hibiki': 43,
  'Glenfiddich Reserva Rum Cask': 40, 'The Balvenie PortWood': 40, 'Lagavulin': 52,
  'Highland Park': 46, 'Springbank': 46, 'Redbreast Reserve': 46, 'Dalmore King Alexander III': 40,
};
const sql = neon(process.env.DATABASE_URL);
const result = await sql.transaction(Object.entries(abv).map(([name, value]) => sql`
  update bottles set abv=${String(value)}, updated_at=now()
  where user_id=${userId} and status='wishlist' and name=${name} returning name
`));
console.log({ updated: result.flat().length });
