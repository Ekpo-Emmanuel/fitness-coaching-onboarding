import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export class DatabaseConfigError extends Error {
  constructor(message = "DATABASE_URL is not configured.") {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: Database | null = null;

export function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseConfigError();
  cached = drizzle(neon(url), { schema });
  return cached;
}
