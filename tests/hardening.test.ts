import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { parseEncryptionKey } from "@/lib/config";
import { client, coachBrief, form, formVersion, integration, integrationDelivery, submission } from "@/lib/db/schema";
import { createForm, publishForm } from "@/lib/forms/service";
import { encryptJson } from "@/lib/integrations/crypto";
import { MAX_AUTO_DELIVERY_ATTEMPTS, nextDeliveryAttemptAt } from "@/lib/integrations/service";
import { assertSafeWebhookUrl } from "@/lib/integrations/ssrf";
import { emptyAnswers } from "@/lib/onboarding/schema/engine";
import { recoverPendingIntegrationDeliveries, recoverStaleCoachBriefs } from "@/lib/ops/maintenance";
import { deleteClientData, deleteWorkspaceData, exportClientJson, exportWorkspaceJson } from "@/lib/privacy/service";
import { MemoryRateLimiter } from "@/lib/security/rate-limit";
import { assertBotSignals, parseSubmissionAttemptId } from "@/lib/security/payload";
import { submitPublishedForm } from "@/lib/submissions/service";
import { createTestDb, resetTables, seedWorkspace, type TestDb } from "./helpers/pglite";

function blankAnswers(schema: { sections: { fields: { key: string; type: string }[] }[] }, email = "client@example.com") {
  const answers = emptyAnswers(schema as never);
  answers.full_name = "Test Client";
  answers.email = email;
  answers.accuracy_acknowledgement = true;
  return answers;
}

const attemptA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const attemptB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("phase 8 hardening", () => {
  let db: TestDb;
  let pg: PGlite;

  beforeAll(async () => {
    const created = await createTestDb();
    db = created.db;
    pg = created.client;
  });

  afterEach(async () => {
    await resetTables(db);
  });

  afterAll(async () => {
    await pg.close();
  });

  it("rejects weak encryption keys", () => {
    expect(() => parseEncryptionKey("hunter2")).toThrow(/32 cryptographically random bytes/);
    expect(parseEncryptionKey("0".repeat(64)).length).toBe(32);
  });

  it("rate limits bursts and isolates keys", async () => {
    const limiter = new MemoryRateLimiter(2, 60_000, () => 1_000);
    expect((await limiter.take("a")).ok).toBe(true);
    expect((await limiter.take("a")).ok).toBe(true);
    expect((await limiter.take("a")).ok).toBe(false);
    expect((await limiter.take("b")).ok).toBe(true);
  });

  it("replays the same submission attempt without duplicating rows", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    await db.insert(integration).values({
      workspaceId: owner.workspaceId,
      type: "webhook",
      name: "Hook",
      status: "connected",
      config: { endpointUrl: "https://example.com/hook" },
      encryptedCredentials: encryptJson({ signingSecret: "secret" }),
    });
    const first = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema),
      submissionAttemptId: attemptA,
      destinationOptions: { webhookFetch: async () => new Response("ok", { status: 200 }) },
    });
    const second = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema),
      submissionAttemptId: attemptA,
      destinationOptions: { webhookFetch: async () => new Response("ok", { status: 200 }) },
    });
    expect(second.submissionId).toBe(first.submissionId);
    expect(second.replayed).toBe(true);
    expect(await db.select().from(submission)).toHaveLength(1);
    expect(await db.select().from(client)).toHaveLength(1);
    expect(await db.select().from(integrationDelivery)).toHaveLength(1);
  });

  it("exports client data without secrets and blocks other workspaces", async () => {
    const a = await seedWorkspace(db, "a");
    const b = await seedWorkspace(db, "b");
    const created = await createForm(db, { workspaceId: a.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: a.workspaceId, formId: created.form.id, userId: a.userId });
    await db.insert(integration).values({
      workspaceId: a.workspaceId,
      type: "webhook",
      name: "Hook",
      status: "connected",
      config: { endpointUrl: "https://example.com/hook" },
      encryptedCredentials: encryptJson({ signingSecret: "super-secret" }),
    });
    const saved = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema),
      submissionAttemptId: attemptA,
      skipDeliveryAttempt: true,
    });
    const [sub] = await db.select().from(submission).where(eq(submission.id, saved.submissionId));
    const exported = await exportClientJson(db, a.workspaceId, sub.clientId);
    expect(exported.submissions[0].clientProvided.answers).toBeTruthy();
    expect(exported.submissions[0].aiGenerated).toBeTruthy();
    expect(JSON.stringify(exported)).not.toContain("super-secret");
    await expect(exportClientJson(db, b.workspaceId, sub.clientId)).rejects.toThrow(/not found/i);
    const workspaceExport = await exportWorkspaceJson(db, a.workspaceId);
    expect(JSON.stringify(workspaceExport)).not.toContain("super-secret");
    expect(workspaceExport.integrations[0].endpointUrl).toBe("https://example.com/hook");
  });

  it("deletes client payloads and leaves other clients and forms", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    await db.insert(integration).values({
      workspaceId: owner.workspaceId,
      type: "webhook",
      name: "Hook",
      status: "connected",
      config: { endpointUrl: "https://example.com/hook" },
      encryptedCredentials: encryptJson({ signingSecret: "secret" }),
    });
    const first = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema, "one@example.com"),
      submissionAttemptId: attemptA,
      skipDeliveryAttempt: true,
    });
    await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema, "two@example.com"),
      submissionAttemptId: attemptB,
      skipDeliveryAttempt: true,
    });
    const [target] = await db.select().from(submission).where(eq(submission.id, first.submissionId));
    const result = await deleteClientData(db, owner.workspaceId, target.clientId, owner.userId);
    expect(result.notice).toMatch(/external destinations/i);
    expect(await db.select().from(client)).toHaveLength(1);
    expect(await db.select().from(submission)).toHaveLength(1);
    expect(await db.select().from(form)).toHaveLength(1);
    expect(await db.select().from(formVersion)).toHaveLength(1);
    expect(await db.select().from(integrationDelivery)).toHaveLength(1);
  });

  it("deletes only the requested workspace", async () => {
    const a = await seedWorkspace(db, "a");
    const b = await seedWorkspace(db, "b");
    await deleteWorkspaceData(db, a.workspaceId, a.userId, "owner");
    await expect(deleteWorkspaceData(db, b.workspaceId, b.userId, "coach")).rejects.toThrow(/owner/i);
    expect((await exportWorkspaceJson(db, b.workspaceId)).workspace.id).toBe(b.workspaceId);
  });

  it("recovers stale processing deliveries and coach briefs", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    const saved = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema),
      submissionAttemptId: attemptA,
      skipDeliveryAttempt: true,
    });
    const [hook] = await db
      .insert(integration)
      .values({
        workspaceId: owner.workspaceId,
        type: "webhook",
        name: "Hook",
        status: "connected",
        config: { endpointUrl: "https://example.com/hook" },
        encryptedCredentials: encryptJson({ signingSecret: "secret" }),
      })
      .returning();
    const stale = new Date(Date.now() - 10 * 60 * 1000);
    const [delivery] = await db
      .insert(integrationDelivery)
      .values({
        workspaceId: owner.workspaceId,
        integrationId: hook.id,
        submissionId: saved.submissionId,
        payload: { event: "onboarding.submitted" },
        status: "processing",
        attemptCount: 1,
        processingStartedAt: stale,
      })
      .returning();
    await recoverPendingIntegrationDeliveries(db, 20, {
      webhookFetch: async () => new Response("ok", { status: 200 }),
    });
    const [after] = await db.select().from(integrationDelivery).where(eq(integrationDelivery.id, delivery.id));
    expect(["sent", "failed"]).toContain(after.status);
    await db.update(coachBrief).set({ status: "processing", updatedAt: stale }).where(eq(coachBrief.submissionId, saved.submissionId));
    const recovered = await recoverStaleCoachBriefs(db);
    expect(recovered.recovered).toBeGreaterThan(0);
    const [brief] = await db.select().from(coachBrief);
    expect(brief.status).toBe("failed");
    expect(nextDeliveryAttemptAt(MAX_AUTO_DELIVERY_ATTEMPTS)).toBeNull();
  });

  it("hardens SSRF with mocked DNS and bot signals", async () => {
    await expect(assertSafeWebhookUrl("https://127.0.0.1/x")).rejects.toThrow(/not allowed/i);
    await expect(assertSafeWebhookUrl("https://localhost/x")).rejects.toThrow(/not allowed/i);
    await expect(assertSafeWebhookUrl("https://[::1]/x")).rejects.toThrow(/not allowed|valid/i);
    await expect(assertSafeWebhookUrl("https://10.0.0.5/x")).rejects.toThrow(/not allowed/i);
    await expect(assertSafeWebhookUrl("https://169.254.169.254/")).rejects.toThrow(/not allowed/i);
    await expect(
      assertSafeWebhookUrl("https://evil.test/hook", { lookup: async () => [{ address: "127.0.0.1" }] }),
    ).rejects.toThrow(/not allowed/i);
    expect(parseSubmissionAttemptId(attemptA)).toBe(attemptA);
    expect(() => parseSubmissionAttemptId("nope")).toThrow();
    expect(() => assertBotSignals({ honeypot: "http://spam", startedAt: Date.now() - 4000 })).toThrow();
    expect(() => assertBotSignals({ startedAt: Date.now() })).toThrow();
    expect(() => assertBotSignals({ startedAt: Date.now() - 4000 })).not.toThrow();
  });
});
