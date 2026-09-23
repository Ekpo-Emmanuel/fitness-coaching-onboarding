import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as schema from "@/lib/db/schema";
import type { FormsDatabase } from "@/lib/db/node";
import {
  client,
  coachingProfile,
  form,
  formDraft,
  formVersion,
  submission,
  agentChangeSet,
  agentMessage,
  agentThread,
  reviewFlag,
  coachBrief,
  integration,
  integrationDelivery,
  auditEvent,
  user,
  workspace,
  workspaceMember,
} from "@/lib/db/schema";

if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
  process.env.INTEGRATION_ENCRYPTION_KEY = "0".repeat(64);
}

export type TestDb = FormsDatabase;

async function execMigration(client: PGlite, file: string) {
  const sql = readFileSync(resolve(file), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) await client.exec(trimmed);
  }
}

let migrateGate = Promise.resolve();

export async function createTestDb() {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = migrateGate;
  migrateGate = previous.then(() => held);
  await previous;
  try {
    const pg = new PGlite();
    await execMigration(pg, "drizzle/0000_phase1_foundation.sql");
    await execMigration(pg, "drizzle/0001_phase3_forms.sql");
    await execMigration(pg, "drizzle/0002_phase4_clients.sql");
    await execMigration(pg, "drizzle/0003_phase5_agent.sql");
    await execMigration(pg, "drizzle/0004_phase6_review.sql");
    await execMigration(pg, "drizzle/0005_phase7_integrations.sql");
    await execMigration(pg, "drizzle/0006_phase8_hardening.sql");
    return { client: pg, db: drizzle(pg, { schema }) as unknown as TestDb };
  } finally {
    release();
  }
}

export async function seedWorkspace(db: TestDb, suffix: string) {
  const userId = `user_${suffix}`;
  const [createdWorkspace] = await db.insert(workspace).values({ name: `Gym ${suffix}` }).returning();
  await db.insert(user).values({
    id: userId,
    name: suffix,
    email: `${suffix}@example.com`,
    emailVerified: true,
  });
  await db.insert(workspaceMember).values({
    workspaceId: createdWorkspace.id,
    userId,
    role: "owner",
  });
  await db.insert(coachingProfile).values({
    workspaceId: createdWorkspace.id,
    businessName: `Gym ${suffix}`,
    coachName: suffix,
    targetClientDescription: "Adults",
  });
  return { workspaceId: createdWorkspace.id, userId };
}

export async function resetTables(db: TestDb) {
  await db.delete(auditEvent);
  await db.delete(integrationDelivery);
  await db.delete(integration);
  await db.delete(coachBrief);
  await db.delete(reviewFlag);
  await db.delete(agentMessage);
  await db.delete(agentChangeSet);
  await db.delete(agentThread);
  await db.delete(submission);
  await db.delete(client);
  await db.delete(formVersion);
  await db.delete(formDraft);
  await db.delete(form);
  await db.delete(coachingProfile);
  await db.delete(workspaceMember);
  await db.delete(workspace);
  await db.delete(user);
}
