import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cached: { url: string; db: ReturnType<typeof create> } | undefined;

function create(url: string) {
  // Neon's HTTP driver: one fetch per query, no pooled connections to manage
  // in serverless functions.
  return drizzle(neon(url), { schema });
}

export function getDb(url: string) {
  if (cached?.url !== url) cached = { url, db: create(url) };
  return cached.db;
}
