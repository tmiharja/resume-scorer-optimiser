import { describe, expect, it } from "vitest";
import { databaseUrl, migrationUrl } from "@/db/url";

const POOLED = "postgres://pooled.neon.tech/db";
const DIRECT = "postgres://direct.neon.tech/db";

describe("database URL resolution", () => {
  it("uses DATABASE_URL from the default Neon prefix", () => {
    expect(databaseUrl({ DATABASE_URL: POOLED })).toBe(POOLED);
  });

  it("accepts both shapes of the NEON prefix, ahead of DATABASE_URL", () => {
    expect(databaseUrl({ NEON_URL: POOLED, DATABASE_URL: "postgres://stale/db" })).toBe(POOLED);
    expect(databaseUrl({ NEON_DATABASE_URL: POOLED })).toBe(POOLED);
  });

  it("ignores empty values", () => {
    expect(databaseUrl({ NEON_URL: "", DATABASE_URL: POOLED })).toBe(POOLED);
    expect(databaseUrl({})).toBeUndefined();
  });

  it("migrates over the direct connection when there is one", () => {
    expect(migrationUrl({ NEON_URL: POOLED, NEON_URL_UNPOOLED: DIRECT })).toBe(DIRECT);
    expect(migrationUrl({ DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT })).toBe(DIRECT);
    expect(migrationUrl({ NEON_DATABASE_URL: POOLED })).toBe(POOLED);
    expect(migrationUrl({})).toBeUndefined();
  });
});
