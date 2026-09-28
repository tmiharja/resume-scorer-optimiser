import { defineConfig } from "drizzle-kit";
import { migrationUrl } from "./src/db/url";

// `npm run db:generate` writes SQL migrations to ./drizzle (committed).
// `npm run db:migrate` applies them to the Neon database. Migrations prefer the
// direct (unpooled) connection the Vercel Neon integration provides, under
// either variable prefix (src/db/url.ts).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: migrationUrl(process.env) ?? "" },
  strict: true,
});
