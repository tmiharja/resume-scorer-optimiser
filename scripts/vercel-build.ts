// Vercel build command (see vercel.json): validate env → apply DB migrations → next build.
// Locally, `npm run build` still just runs `next build`.
import { execSync } from "node:child_process";
import { migrationUrl } from "../src/db/url";

const run = (cmd: string) => execSync(cmd, { stdio: "inherit", env: process.env });

run("npx tsx scripts/check-env.ts");

if (migrationUrl(process.env)) {
  // Idempotent: drizzle-kit only applies migrations not yet recorded in the
  // database. Preview deployments get their own Neon branch via the integration.
  console.log("Applying database migrations…");
  run("npx drizzle-kit migrate");
} else {
  console.log("No database URL: skipping migrations (analytics disabled).");
}

run("npx next build");
