import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DatabaseConfigError } from "./index";
import { pgConnectionString } from "./pg-url";
import * as schema from "./schema";

type NodeDatabase = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool | null = null;
let cached: NodeDatabase | null = null;

export function getPoolDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseConfigError();
  pool = new Pool({ connectionString: pgConnectionString(url) });
  cached = drizzle(pool, { schema });
  return cached;
}

export type FormsDatabase = NodeDatabase;
