import { and, eq, lte, or } from "drizzle-orm";
import { coachBrief, integrationDelivery } from "@/lib/db/schema";
import type { FormsDatabase } from "@/lib/db/node";
import { log } from "@/lib/observability/log";
import { MAX_AUTO_DELIVERY_ATTEMPTS, STALE_PROCESSING_MS, processDelivery } from "@/lib/integrations/service";
import type { DestinationOptions } from "@/lib/integrations/registry";

const STALE_BRIEF_MS = 3 * 60 * 1000;

export async function recoverPendingIntegrationDeliveries(db: FormsDatabase, limit = 20, options?: DestinationOptions) {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
  const due = new Date();
  const rows = await db
    .select({
      id: integrationDelivery.id,
      workspaceId: integrationDelivery.workspaceId,
    })
    .from(integrationDelivery)
    .where(
      and(
        sqlLessThanAttempts(),
        or(
          eq(integrationDelivery.status, "pending"),
          and(eq(integrationDelivery.status, "failed"), lte(integrationDelivery.nextAttemptAt, due)),
          and(eq(integrationDelivery.status, "processing"), lte(integrationDelivery.processingStartedAt, staleBefore)),
        ),
      ),
    )
    .limit(limit);

  let processed = 0;
  for (const row of rows) {
    await processDelivery(db, row.workspaceId, row.id, options);
    processed += 1;
  }
  log.info("maintenance_deliveries", { count: processed });
  return { processed };
}

function sqlLessThanAttempts() {
  return lte(integrationDelivery.attemptCount, MAX_AUTO_DELIVERY_ATTEMPTS - 1);
}

export async function recoverStaleCoachBriefs(db: FormsDatabase) {
  const staleBefore = new Date(Date.now() - STALE_BRIEF_MS);
  const reset = await db
    .update(coachBrief)
    .set({ status: "failed", updatedAt: new Date() })
    .where(and(eq(coachBrief.status, "processing"), lte(coachBrief.updatedAt, staleBefore)))
    .returning({ id: coachBrief.id });
  log.info("maintenance_coach_briefs", { recovered: reset.length });
  return { recovered: reset.length };
}

export async function runMaintenance(db: FormsDatabase) {
  const deliveries = await recoverPendingIntegrationDeliveries(db);
  const briefs = await recoverStaleCoachBriefs(db);
  return { deliveries: deliveries.processed, briefs: briefs.recovered };
}
