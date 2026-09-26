/**
 * Fails the build when a production deployment is misconfigured, listing the
 * missing or invalid variable names (never their values). Run by
 * scripts/vercel-build.mjs before `next build`.
 */
import { parseEnv } from "../src/env";

try {
  const env = parseEnv(process.env);
  const mode = env.isProduction ? "production" : (process.env.VERCEL_ENV ?? "local");
  console.log(
    `✓ Environment OK (${mode}): models ${[
      env.MODEL_EXTRACTOR,
      env.MODEL_CRITIC,
      env.MODEL_MATCHER,
      env.MODEL_REWRITER,
      env.MODEL_VERIFIER,
    ].join(
      " / ",
    )}, ${env.RATE_LIMIT_PER_DAY}/day per visitor, budget US$${env.MONTHLY_BUDGET_USD}/month`,
  );
} catch (error) {
  console.error(`✗ ${(error as Error).message}`);
  console.error("Set these in Vercel → Project → Settings → Environment Variables, then redeploy.");
  process.exit(1);
}
