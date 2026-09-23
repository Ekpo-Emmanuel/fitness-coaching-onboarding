import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { integration, integrationDelivery } from "@/lib/db/schema";
import type { FormsDatabase } from "@/lib/db/node";
import { FormServiceError } from "@/lib/forms/errors";
import { log } from "@/lib/observability/log";
import { encryptJson, decryptJson } from "./crypto";
import { createGoogleSheetsApi } from "./google-api";
import { parseSpreadsheetId } from "./destinations/google-sheets";
import { buildOnboardingSubmittedEvent } from "./event";
import {
  decryptGoogleTokens,
  encryptGoogleTokens,
  googleOAuthConfigured,
  refreshGoogleTokens,
  revokeGoogleTokens,
  type GoogleOAuthTokens,
} from "./google-oauth";
import { destinationFor, decryptIntegrationCredentials, type DestinationOptions } from "./registry";
import { validateWebhookEndpoint } from "./destinations/webhook";
import { signWebhookBody } from "./webhook-sign";
import { webhookHttpAllowed, assertSafeWebhookUrl } from "./ssrf";
import type { IntegrationContext } from "./types";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";

function clipError(value: string) {
  return value.replace(/\s+/g, " ").slice(0, 180);
}

export const MAX_AUTO_DELIVERY_ATTEMPTS = 5;
export const STALE_PROCESSING_MS = 2 * 60 * 1000;

export function nextDeliveryAttemptAt(attemptCount: number) {
  if (attemptCount >= MAX_AUTO_DELIVERY_ATTEMPTS) return null;
  const delays = [30_000, 120_000, 600_000, 1_800_000];
  return new Date(Date.now() + delays[Math.min(Math.max(attemptCount, 1) - 1, delays.length - 1)]);
}

function failPatch(attemptCount: number, lastError: string, auto: boolean) {
  return {
    status: "failed" as const,
    lastError,
    updatedAt: new Date(),
    nextAttemptAt: auto ? nextDeliveryAttemptAt(attemptCount) : null,
    processingStartedAt: null,
  };
}

function toContext(row: typeof integration.$inferSelect): IntegrationContext {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type,
    name: row.name,
    status: row.status,
    config: row.config ?? {},
    credentials: decryptIntegrationCredentials(row.type, row.encryptedCredentials),
  };
}

export function publicDelivery(row: typeof integrationDelivery.$inferSelect) {
  const payload = row.payload as { client?: { id?: string } };
  return {
    id: row.id,
    integrationId: row.integrationId,
    submissionId: row.submissionId,
    eventType: row.eventType,
    status: row.status,
    attemptCount: row.attemptCount,
    lastAttemptAt: row.lastAttemptAt,
    lastError: row.lastError,
    clientId: typeof payload.client?.id === "string" ? payload.client.id : null,
  };
}

export function publicIntegration(row: typeof integration.$inferSelect) {
  const config = row.config ?? {};
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    status: row.status,
    lastError: row.lastError,
    updatedAt: row.updatedAt,
    spreadsheetId: typeof config.spreadsheetId === "string" ? config.spreadsheetId : null,
    spreadsheetTitle: typeof config.spreadsheetTitle === "string" ? config.spreadsheetTitle : null,
    endpointUrl: typeof config.endpointUrl === "string" ? config.endpointUrl : null,
  };
}

export async function listIntegrations(db: FormsDatabase, workspaceId: string) {
  return db
    .select()
    .from(integration)
    .where(eq(integration.workspaceId, workspaceId))
    .orderBy(desc(integration.updatedAt));
}

export async function getWorkspaceIntegration(db: FormsDatabase, workspaceId: string, integrationId: string) {
  const rows = await db
    .select()
    .from(integration)
    .where(and(eq(integration.id, integrationId), eq(integration.workspaceId, workspaceId)))
    .limit(1);
  const record = rows[0];
  if (!record) throw new FormServiceError("Connection not found.", 404);
  return record;
}

export async function listDeliveries(db: FormsDatabase, workspaceId: string, integrationId?: string) {
  const filters = [eq(integrationDelivery.workspaceId, workspaceId)];
  if (integrationId) filters.push(eq(integrationDelivery.integrationId, integrationId));
  return db
    .select()
    .from(integrationDelivery)
    .where(and(...filters))
    .orderBy(desc(integrationDelivery.createdAt))
    .limit(50);
}

export function fieldCatalog(schema: OnboardingSchema) {
  return schema.sections.flatMap((section) =>
    section.fields.flatMap((field) => {
      const keys = field.type === "unit_number" ? [field.key, field.unitKey, field.companionKey].filter(Boolean) : [field.key];
      return keys.map((fieldKey) => ({
        sectionKey: section.key,
        sectionTitle: section.title,
        fieldKey: String(fieldKey),
        fieldLabel: field.label,
        fieldType: field.type,
      }));
    }),
  );
}

export async function createSubmissionDeliveries(
  db: Pick<FormsDatabase, "select" | "insert">,
  input: {
    workspaceId: string;
    source: "public_form" | "legacy_import";
    client: { id: string; fullName: string; email: string; phone?: string | null };
    form: { id: string; name: string };
    version: { versionNumber: number; schema: OnboardingSchema };
    submission: { id: string; submittedAt: Date; reviewStatus: string; answers: Record<string, unknown> };
    reviewFlags: Array<{ code: string; label: string; sourceFieldKeys: string[] }>;
  },
) {
  if (input.source !== "public_form") return [];
  const destinations = await db
    .select()
    .from(integration)
    .where(and(eq(integration.workspaceId, input.workspaceId), eq(integration.status, "connected")));
  const ids: string[] = [];
  const fields = fieldCatalog(input.version.schema);
  for (const dest of destinations) {
    const deliveryId = crypto.randomUUID();
    const payload = buildOnboardingSubmittedEvent({
      deliveryId,
      occurredAt: input.submission.submittedAt,
      client: input.client,
      form: { id: input.form.id, name: input.form.name, versionNumber: input.version.versionNumber },
      submission: input.submission,
      reviewFlags: input.reviewFlags,
      fields,
    });
    const inserted = await db
      .insert(integrationDelivery)
      .values({
        id: deliveryId,
        workspaceId: input.workspaceId,
        integrationId: dest.id,
        submissionId: input.submission.id,
        eventType: "onboarding.submitted",
        payloadVersion: "1",
        payload,
        status: "pending",
        attemptCount: 0,
      })
      .onConflictDoNothing({
        target: [integrationDelivery.integrationId, integrationDelivery.submissionId, integrationDelivery.eventType],
      })
      .returning({ id: integrationDelivery.id });
    if (inserted[0]) ids.push(inserted[0].id);
  }
  return ids;
}

export async function processDelivery(
  db: FormsDatabase,
  workspaceId: string,
  deliveryId: string,
  options?: DestinationOptions & { force?: boolean },
) {
  const rows = await db
    .select()
    .from(integrationDelivery)
    .where(and(eq(integrationDelivery.id, deliveryId), eq(integrationDelivery.workspaceId, workspaceId)))
    .limit(1);
  const delivery = rows[0];
  if (!delivery) throw new FormServiceError("Delivery not found.", 404);
  if (delivery.status === "sent") return delivery;
  const staleProcessing =
    delivery.status === "processing" &&
    delivery.processingStartedAt &&
    Date.now() - delivery.processingStartedAt.getTime() > STALE_PROCESSING_MS;
  if (delivery.status === "processing" && !staleProcessing) return delivery;
  if (!options?.force && delivery.attemptCount >= MAX_AUTO_DELIVERY_ATTEMPTS && delivery.status === "failed") {
    return delivery;
  }

  const now = new Date();
  const [claimed] = await db
    .update(integrationDelivery)
    .set({
      status: "processing",
      attemptCount: delivery.attemptCount + 1,
      lastAttemptAt: now,
      processingStartedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(integrationDelivery.id, delivery.id),
        or(
          eq(integrationDelivery.status, "pending"),
          eq(integrationDelivery.status, "failed"),
          eq(integrationDelivery.status, "processing"),
        ),
      ),
    )
    .returning();
  if (!claimed) {
    return (
      await db.select().from(integrationDelivery).where(eq(integrationDelivery.id, delivery.id)).limit(1)
    )[0] ?? delivery;
  }

  const dest = await getWorkspaceIntegration(db, workspaceId, delivery.integrationId);
  if (dest.status !== "connected") {
    const [failed] = await db
      .update(integrationDelivery)
      .set(failPatch(claimed.attemptCount, "destination_disabled", !options?.force))
      .where(eq(integrationDelivery.id, claimed.id))
      .returning();
    return failed ?? claimed;
  }

  const persistGoogleTokens = async (tokens: GoogleOAuthTokens) => {
    await db
      .update(integration)
      .set({ encryptedCredentials: encryptGoogleTokens(tokens), updatedAt: new Date(), status: "connected", lastError: null })
      .where(eq(integration.id, dest.id));
  };

  try {
    const result = await destinationFor(toContext(dest), { ...options, persistGoogleTokens }).deliver(
      toContext(dest),
      delivery.payload as Record<string, unknown>,
    );
    if (result.ok) {
      const [sent] = await db
        .update(integrationDelivery)
        .set({
          status: "sent",
          sentAt: new Date(),
          lastError: null,
          nextAttemptAt: null,
          processingStartedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(integrationDelivery.id, claimed.id))
        .returning();
      return sent ?? claimed;
    }
    if (result.reconnect) {
      await db
        .update(integration)
        .set({ status: "error", lastError: clipError(result.error ?? "reconnect_required"), updatedAt: new Date() })
        .where(eq(integration.id, dest.id));
      log.error("integration_reconnect_required", { integrationId: dest.id, deliveryId: claimed.id });
    }
    log.error("integration_delivery_failed", { integrationId: dest.id, deliveryId: claimed.id });
    const [failed] = await db
      .update(integrationDelivery)
      .set(failPatch(claimed.attemptCount, clipError(result.error ?? "delivery_failed"), !options?.force))
      .where(eq(integrationDelivery.id, claimed.id))
      .returning();
    return failed ?? claimed;
  } catch {
    log.error("integration_delivery_failed", { integrationId: dest.id, deliveryId: claimed.id });
    const [failed] = await db
      .update(integrationDelivery)
      .set(failPatch(claimed.attemptCount, "delivery_failed", !options?.force))
      .where(eq(integrationDelivery.id, claimed.id))
      .returning();
    return failed ?? claimed;
  }
}

export async function attemptDeliveries(
  db: FormsDatabase,
  workspaceId: string,
  deliveryIds: string[],
  options?: DestinationOptions,
) {
  for (const id of deliveryIds) {
    try {
      await processDelivery(db, workspaceId, id, options);
    } catch {
      // Canonical Submission already committed.
    }
  }
}

export async function retryDelivery(db: FormsDatabase, workspaceId: string, deliveryId: string, options?: DestinationOptions) {
  return processDelivery(db, workspaceId, deliveryId, { ...options, force: true });
}

export async function retryFailedForIntegration(db: FormsDatabase, workspaceId: string, integrationId: string, options?: DestinationOptions) {
  await getWorkspaceIntegration(db, workspaceId, integrationId);
  const failed = await db
    .select({ id: integrationDelivery.id })
    .from(integrationDelivery)
    .where(
      and(
        eq(integrationDelivery.workspaceId, workspaceId),
        eq(integrationDelivery.integrationId, integrationId),
        inArray(integrationDelivery.status, ["failed", "pending"]),
      ),
    )
    .limit(25);
  const results = [];
  for (const item of failed) {
    results.push(await processDelivery(db, workspaceId, item.id, options));
  }
  return results;
}

export async function createWebhookIntegration(db: FormsDatabase, workspaceId: string, input: { name: string; endpointUrl: string }) {
  const name = input.name.trim() || "Webhook";
  const endpointUrl = await validateWebhookEndpoint(input.endpointUrl);
  const signingSecret = randomBytes(32).toString("hex");
  const [created] = await db
    .insert(integration)
    .values({
      workspaceId,
      type: "webhook",
      name,
      status: "connected",
      config: { endpointUrl },
      encryptedCredentials: encryptJson({ signingSecret }),
    })
    .returning();
  return { integration: publicIntegration(created), signingSecret };
}

export async function rotateWebhookSecret(db: FormsDatabase, workspaceId: string, integrationId: string) {
  const record = await getWorkspaceIntegration(db, workspaceId, integrationId);
  if (record.type !== "webhook") throw new FormServiceError("That connection is not a webhook.");
  const signingSecret = randomBytes(32).toString("hex");
  const [updated] = await db
    .update(integration)
    .set({ encryptedCredentials: encryptJson({ signingSecret }), updatedAt: new Date(), status: "connected", lastError: null })
    .where(and(eq(integration.id, record.id), eq(integration.workspaceId, workspaceId)))
    .returning();
  return { integration: publicIntegration(updated), signingSecret };
}

export async function setIntegrationStatus(
  db: FormsDatabase,
  workspaceId: string,
  integrationId: string,
  status: "connected" | "disabled",
) {
  const record = await getWorkspaceIntegration(db, workspaceId, integrationId);
  const [updated] = await db
    .update(integration)
    .set({ status, updatedAt: new Date(), lastError: status === "connected" ? null : record.lastError })
    .where(eq(integration.id, record.id))
    .returning();
  return publicIntegration(updated);
}

export async function disconnectGoogle(db: FormsDatabase, workspaceId: string, integrationId: string) {
  const record = await getWorkspaceIntegration(db, workspaceId, integrationId);
  if (record.type !== "google_sheets") throw new FormServiceError("That connection is not Google Sheets.");
  if (record.encryptedCredentials) {
    try {
      await revokeGoogleTokens(decryptGoogleTokens(record.encryptedCredentials));
    } catch {
      // Keep disconnect even if Google revoke fails.
    }
  }
  const [updated] = await db
    .update(integration)
    .set({
      status: "disabled",
      encryptedCredentials: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(integration.id, record.id))
    .returning();
  return publicIntegration(updated);
}

export async function upsertGoogleIntegration(db: FormsDatabase, workspaceId: string, tokens: GoogleOAuthTokens) {
  const existing = (
    await db
      .select()
      .from(integration)
      .where(and(eq(integration.workspaceId, workspaceId), eq(integration.type, "google_sheets")))
      .limit(1)
  )[0];
  const encryptedCredentials = encryptGoogleTokens(tokens);
  if (existing) {
    const merged = existing.encryptedCredentials
      ? { ...decryptGoogleTokens(existing.encryptedCredentials), ...tokens, refresh_token: tokens.refresh_token || decryptGoogleTokens(existing.encryptedCredentials).refresh_token }
      : tokens;
    const [updated] = await db
      .update(integration)
      .set({
        status: "connected",
        encryptedCredentials: encryptGoogleTokens(merged),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(integration.id, existing.id))
      .returning();
    return publicIntegration(updated);
  }
  const [created] = await db
    .insert(integration)
    .values({
      workspaceId,
      type: "google_sheets",
      name: "Google Sheets",
      status: "connected",
      config: {},
      encryptedCredentials,
    })
    .returning();
  return publicIntegration(created);
}

export async function saveGoogleSpreadsheet(
  db: FormsDatabase,
  workspaceId: string,
  integrationId: string,
  input: { spreadsheetId?: string; create?: boolean },
) {
  if (!googleOAuthConfigured()) throw new FormServiceError("Google Sheets OAuth is not configured.");
  const record = await getWorkspaceIntegration(db, workspaceId, integrationId);
  if (record.type !== "google_sheets" || !record.encryptedCredentials) {
    throw new FormServiceError("Connect Google Sheets first.");
  }
  let tokens = decryptGoogleTokens(record.encryptedCredentials);
  if (tokens.refresh_token) {
    try {
      tokens = await refreshGoogleTokens(tokens);
    } catch {
      throw new FormServiceError("Reconnect Google Sheets.");
    }
  }
  const api = createGoogleSheetsApi(tokens);
  let meta;
  if (input.create) {
    meta = await api.createSpreadsheet("Client Onboarding Data");
  } else {
    const spreadsheetId = parseSpreadsheetId(input.spreadsheetId ?? "");
    if (!spreadsheetId) throw new FormServiceError("Paste a Google Sheets URL or spreadsheet ID.");
    try {
      meta = await api.getSpreadsheet(spreadsheetId);
    } catch {
      throw new FormServiceError("Could not access that spreadsheet. Check sharing and try again.");
    }
  }
  const [updated] = await db
    .update(integration)
    .set({
      config: { spreadsheetId: meta.spreadsheetId, spreadsheetTitle: meta.title },
      encryptedCredentials: encryptGoogleTokens(tokens),
      status: "connected",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(integration.id, record.id))
    .returning();
  return publicIntegration(updated);
}

export async function testGoogleConnection(db: FormsDatabase, workspaceId: string, integrationId: string) {
  const record = await getWorkspaceIntegration(db, workspaceId, integrationId);
  if (record.type !== "google_sheets" || !record.encryptedCredentials) {
    throw new FormServiceError("Connect Google Sheets first.");
  }
  const spreadsheetId = String(record.config?.spreadsheetId ?? "");
  if (!spreadsheetId) throw new FormServiceError("Choose a spreadsheet first.");
  let tokens = decryptGoogleTokens(record.encryptedCredentials);
  if (tokens.refresh_token) tokens = await refreshGoogleTokens(tokens);
  const meta = await createGoogleSheetsApi(tokens).getSpreadsheet(spreadsheetId);
  await db
    .update(integration)
    .set({ encryptedCredentials: encryptGoogleTokens(tokens), status: "connected", lastError: null, updatedAt: new Date() })
    .where(eq(integration.id, record.id));
  return { ok: true as const, title: meta.title };
}

export async function sendWebhookTest(db: FormsDatabase, workspaceId: string, integrationId: string, fetchImpl: typeof fetch = fetch) {
  const record = await getWorkspaceIntegration(db, workspaceId, integrationId);
  if (record.type !== "webhook") throw new FormServiceError("That connection is not a webhook.");
  if (record.status !== "connected") throw new FormServiceError("Enable this webhook first.");
  const endpointUrl = String(record.config?.endpointUrl ?? "");
  const secret = String(decryptJson<{ signingSecret: string }>(record.encryptedCredentials ?? "").signingSecret ?? "");
  await assertSafeWebhookUrl(endpointUrl, { allowHttpLocal: webhookHttpAllowed() });
  const payload = {
    event: "integration.test",
    payloadVersion: "1",
    deliveryId: "test",
    occurredAt: new Date().toISOString(),
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await fetchImpl(endpointUrl, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      "X-Onboarding-Event": "integration.test",
      "X-Onboarding-Delivery-Id": "test",
      "X-Onboarding-Timestamp": timestamp,
      "X-Onboarding-Signature": signWebhookBody(secret, timestamp, rawBody),
    },
    body: rawBody,
    signal: AbortSignal.timeout(4000),
  });
  if (response.status < 200 || response.status >= 300) {
    throw new FormServiceError(`Test webhook returned HTTP ${response.status}.`);
  }
  return { ok: true as const };
}

export { googleOAuthConfigured };
