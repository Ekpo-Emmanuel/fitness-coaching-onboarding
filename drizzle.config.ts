import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { pgConnectionString } from "./lib/db/pg-url";

loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run Drizzle Kit.");
}

// drizzle-kit prefers `pg` over `@neondatabase/serverless`. Keep `pg` installed
// so `db:migrate` uses TCP/TLS, not Neon websockets.

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: pgConnectionString(databaseUrl),
  },
});
