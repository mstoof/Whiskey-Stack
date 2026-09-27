import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // We manage our own tables; leave Neon Auth's synced schema alone.
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
