import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { form, formVersion, integration, integrationDelivery, submission } from "@/lib/db/schema";
import { decryptSecret, encryptSecret, encryptJson } from "@/lib/integrations/crypto";
import { GoogleSheetsDestination, parseSpreadsheetId, type GoogleSheetsApi } from "@/lib/integrations/destinations/google-sheets";
import {
  createSubmissionDeliveries,
  createWebhookIntegration,
  disconnectGoogle,
  listDeliveries,
  processDelivery,
  rotateWebhookSecret,
  setIntegrationStatus,
} from "@/lib/integrations/service";
import { signWebhookBody, verifyWebhookSignature } from "@/lib/integrations/webhook-sign";
import { assertSafeWebhookUrl } from "@/lib/integrations/ssrf";
import { createOAuthState, readOAuthState } from "@/lib/integrations/oauth-state";
import { createForm, publishForm } from "@/lib/forms/service";
import { FormServiceError } from "@/lib/forms/errors";
import { emptyAnswers } from "@/lib/onboarding/schema/engine";
import { persistCanonicalSubmission, submitPublishedForm } from "@/lib/submissions/service";
import { createTestDb, resetTables, seedWorkspace, type TestDb } from "./helpers/pglite";

function blankAnswers(schema: { sections: { fields: { key: string; type: string }[] }[] }, email = "client@example.com") {
  const answers = emptyAnswers(schema as never);
  answers.full_name = "Test Client";
  answers.email = email;
  answers.accuracy_acknowledgement = true;
  return answers;
}

function memorySheets(): GoogleSheetsApi & { store: Map<string, Record<string, string[][]>> } {
  const store = new Map<string, Record<string, string[][]>>();
  function book(id: string) {
    if (!store.has(id)) store.set(id, {});
    return store.get(id)!;
  }
  function tabName(range: string) {
    return range.split("!")[0].replaceAll("'", "");
  }
  return {
    store,
    async getSpreadsheet(spreadsheetId) {
      if (!store.has(spreadsheetId)) throw new Error("403");
      return { spreadsheetId, title: "Onboarding", sheets: Object.keys(book(spreadsheetId)) };
    },
    async createSpreadsheet(title) {
      store.set("sheet_new", {});
      return { spreadsheetId: "sheet_new", title, sheets: [] };
    },
    async addSheet(spreadsheetId, title) {
      book(spreadsheetId)[title] = [];
    },
    async getValues(spreadsheetId, range) {
      const rows = book(spreadsheetId)[tabName(range)] ?? [];
      if (range.includes("!1:1")) return rows[0] ? [rows[0]] : [];
      if (range.includes("!A2")) return rows.slice(1);
      return rows;
    },
    async updateValues(spreadsheetId, range, values) {
      const name = tabName(range);
      const cell = range.split("!")[1] ?? "A1";
      const row = Number((cell.match(/(\d+)/) ?? [])[1] ?? "1") - 1;
      const rows = book(spreadsheetId)[name] ?? [];
      rows[row] = values[0];
      book(spreadsheetId)[name] = rows;
    },
    async appendValues(spreadsheetId, range, values) {
      const name = tabName(range);
      const rows = book(spreadsheetId)[name] ?? [];
      book(spreadsheetId)[name] = [...rows, ...values];
    },
  };
}

describe("integrations", () => {
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

  it("encrypts and decrypts credentials", () => {
    const envelope = encryptSecret("refresh-token");
    expect(envelope.startsWith("v1.")).toBe(true);
    expect(envelope).not.toContain("refresh-token");
    expect(decryptSecret(envelope)).toBe("refresh-token");
  });

  it("binds OAuth state to the authenticated workspace", () => {
    const state = createOAuthState("ws-a", "user-a");
    expect(readOAuthState(state, "ws-a", "user-a").workspaceId).toBe("ws-a");
    expect(() => readOAuthState(state, "ws-b", "user-a")).toThrow(FormServiceError);
  });

  it("keeps canonical submission when a webhook destination fails", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    await db.insert(integration).values({
      workspaceId: owner.workspaceId,
      type: "webhook",
      name: "CRM",
      status: "connected",
      config: { endpointUrl: "https://example.com/hook" },
      encryptedCredentials: encryptJson({ signingSecret: "secret" }),
    });
    const result = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema),
      destinationOptions: {
        webhookFetch: async () => new Response("no", { status: 500 }),
      },
    });
    expect(result.submissionId).toBeTruthy();
    expect(await db.select().from(submission)).toHaveLength(1);
    const deliveries = await listDeliveries(db, owner.workspaceId);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("failed");
    expect(deliveries[0].lastError).toMatch(/HTTP 500/);
    expect(deliveries[0].payload).toMatchObject({ event: "onboarding.submitted", payloadVersion: "1" });
    const retried = await processDelivery(db, owner.workspaceId, deliveries[0].id, {
      webhookFetch: async () => new Response("ok", { status: 200 }),
    });
    expect(retried.status).toBe("sent");
    expect(retried.attemptCount).toBeGreaterThan(1);
  });

  it("delivers independently to two destinations", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    const sheets = memorySheets();
    await sheets.addSheet("wb", "Sheet1");
    await db.insert(integration).values([
      {
        workspaceId: owner.workspaceId,
        type: "google_sheets",
        name: "Sheets",
        status: "connected",
        config: { spreadsheetId: "wb" },
        encryptedCredentials: encryptJson({ access_token: "t" }),
      },
      {
        workspaceId: owner.workspaceId,
        type: "webhook",
        name: "Hook",
        status: "connected",
        config: { endpointUrl: "https://example.com/hook" },
        encryptedCredentials: encryptJson({ signingSecret: "secret" }),
      },
    ]);
    const result = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema),
      destinationOptions: {
        webhookFetch: async () => new Response("no", { status: 500 }),
        googleSheets: new GoogleSheetsDestination(sheets),
      },
    });
    const rows = await listDeliveries(db, owner.workspaceId);
    expect(rows).toHaveLength(2);
    expect(rows.some((item) => item.status === "sent")).toBe(true);
    expect(rows.some((item) => item.status === "failed")).toBe(true);
    expect(result.submissionId).toBeTruthy();
  });

  it("does not duplicate logical deliveries or increment sent retries", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    await createWebhookIntegration(db, owner.workspaceId, { name: "Hook", endpointUrl: "https://example.com/hook" });
    const first = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema),
      destinationOptions: { webhookFetch: async () => new Response("ok", { status: 200 }) },
    });
    const [sub] = await db.select().from(submission).where(eq(submission.id, first.submissionId));
    const [version] = await db.select().from(formVersion);
    const [formRow] = await db.select().from(form);
    const again = await createSubmissionDeliveries(db, {
      workspaceId: owner.workspaceId,
      source: "public_form",
      client: { id: sub.clientId, fullName: "Test Client", email: "client@example.com" },
      form: { id: formRow.id, name: formRow.name },
      version: { versionNumber: version.versionNumber, schema: version.schema as never },
      submission: {
        id: sub.id,
        submittedAt: sub.submittedAt,
        reviewStatus: sub.reviewStatus,
        answers: sub.answers as Record<string, unknown>,
      },
      reviewFlags: [],
    });
    expect(again).toEqual([]);
    expect(await db.select().from(integrationDelivery)).toHaveLength(1);
    const sent = (await listDeliveries(db, owner.workspaceId))[0];
    const replay = await processDelivery(db, owner.workspaceId, sent.id, {
      webhookFetch: async () => new Response("ok", { status: 200 }),
    });
    expect(replay.status).toBe("sent");
    expect(replay.attemptCount).toBe(sent.attemptCount);
  });

  it("signs webhook bodies independently of the helper and rejects SSRF targets", async () => {
    const body = JSON.stringify({ event: "onboarding.submitted" });
    const timestamp = "1700000000";
    const header = signWebhookBody("secret", timestamp, body);
    const independent = `v1=${createHmac("sha256", "secret").update(`${timestamp}.${body}`).digest("hex")}`;
    expect(header).toBe(independent);
    expect(verifyWebhookSignature("secret", timestamp, body, header)).toBe(true);
    expect(verifyWebhookSignature("secret", timestamp, body, "v1=deadbeef")).toBe(false);
    await expect(assertSafeWebhookUrl("http://127.0.0.1/x")).rejects.toThrow(/HTTPS|not allowed/i);
    await expect(assertSafeWebhookUrl("https://169.254.169.254/")).rejects.toThrow(/not allowed/i);
    await expect(assertSafeWebhookUrl("https://user:pass@example.com/x")).rejects.toThrow(/credentials/i);
  });

  it("does not follow webhook redirects and records timeouts", async () => {
    const owner = await seedWorkspace(db, "a");
    const hook = await createWebhookIntegration(db, owner.workspaceId, {
      name: "Hook",
      endpointUrl: "https://example.com/hook",
    });
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema),
      destinationOptions: {
        webhookFetch: async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1" } }),
      },
    });
    expect((await listDeliveries(db, owner.workspaceId, hook.integration.id))[0].lastError).toBe("redirect_not_followed");
    await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema, "timeout@example.com"),
      destinationOptions: {
        webhookFetch: async () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          throw error;
        },
      },
    });
    expect((await listDeliveries(db, owner.workspaceId, hook.integration.id))[0].lastError).toBe("timeout");
  });

  it("skips legacy imports and disabled integrations", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    const hook = await createWebhookIntegration(db, owner.workspaceId, {
      name: "Hook",
      endpointUrl: "https://example.com/hook",
    });
    await setIntegrationStatus(db, owner.workspaceId, hook.integration.id, "disabled");
    const disabled = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema, "off@example.com"),
    });
    expect(disabled.deliveryIds).toEqual([]);
    const [formRow] = await db.select().from(form);
    const [version] = await db.select().from(formVersion);
    const imported = await persistCanonicalSubmission(db, {
      form: formRow,
      version,
      answers: blankAnswers(created.draft.schema, "legacy@example.com"),
      source: "legacy_import",
      legacySubmissionId: "legacy-1",
    });
    expect(imported.deliveryIds).toEqual([]);
  });

  it("blocks other workspaces from deliveries and rotates webhook secrets", async () => {
    const a = await seedWorkspace(db, "a");
    const b = await seedWorkspace(db, "b");
    const created = await createForm(db, { workspaceId: a.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: a.workspaceId, formId: created.form.id, userId: a.userId });
    const hook = await createWebhookIntegration(db, a.workspaceId, { name: "Hook", endpointUrl: "https://example.com/hook" });
    await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema),
      destinationOptions: { webhookFetch: async () => new Response("ok", { status: 200 }) },
    });
    const delivery = (await listDeliveries(db, a.workspaceId))[0];
    await expect(processDelivery(db, b.workspaceId, delivery.id)).rejects.toBeInstanceOf(FormServiceError);
    expect(await listDeliveries(db, b.workspaceId)).toEqual([]);
    const rotated = await rotateWebhookSecret(db, a.workspaceId, hook.integration.id);
    expect(rotated.signingSecret).not.toBe(hook.signingSecret);
    let usedSecret = "";
    await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema, "after-rotate@example.com"),
      destinationOptions: {
        webhookFetch: async (_url, init) => {
          usedSecret = String((init as RequestInit | undefined)?.headers);
          return new Response("ok", { status: 200 });
        },
      },
    });
    void usedSecret;
    const second = (await listDeliveries(db, a.workspaceId))[0];
    expect(second.status).toBe("sent");
    expect((second.payload as { deliveryId: string }).deliveryId).toBe(second.id);
  });

  it("disconnects Google without deleting delivery history", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    const sheets = memorySheets();
    await sheets.addSheet("wb", "Sheet1");
    const [row] = await db
      .insert(integration)
      .values({
        workspaceId: owner.workspaceId,
        type: "google_sheets",
        name: "Sheets",
        status: "connected",
        config: { spreadsheetId: "wb" },
        encryptedCredentials: encryptJson({ access_token: "t" }),
      })
      .returning();
    await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema),
      destinationOptions: { googleSheets: new GoogleSheetsDestination(sheets) },
    });
    await disconnectGoogle(db, owner.workspaceId, row.id);
    const later = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: blankAnswers(created.draft.schema, "after-disconnect@example.com"),
    });
    expect(later.deliveryIds).toEqual([]);
    expect(await db.select().from(integrationDelivery)).toHaveLength(1);
  });

  it("appends Google columns without duplicating submission rows", async () => {
    const sheets = memorySheets();
    await sheets.addSheet("wb", "x");
    const dest = new GoogleSheetsDestination(sheets);
    const base = {
      event: "onboarding.submitted" as const,
      payloadVersion: "1" as const,
      deliveryId: "d1",
      occurredAt: new Date().toISOString(),
      client: { id: "c1", fullName: "Ada", email: "ada@example.com" },
      form: { id: "11111111-1111-4111-8111-111111111111", name: "Muscle", versionNumber: 1 },
      submission: {
        id: "s1",
        submittedAt: new Date().toISOString(),
        reviewStatus: "new",
        answers: { primary_goal: "muscle" },
      },
      reviewFlags: [],
      fields: [
        { sectionKey: "goals", sectionTitle: "Goals", fieldKey: "primary_goal", fieldLabel: "Goal", fieldType: "short_text" },
      ],
    };
    const connection = {
      id: "i1",
      workspaceId: "w1",
      type: "google_sheets" as const,
      name: "Sheets",
      status: "connected" as const,
      config: { spreadsheetId: "wb" },
      credentials: {},
    };
    await dest.deliver(connection, base);
    await dest.deliver(connection, {
      ...base,
      form: { ...base.form, versionNumber: 2 },
      submission: { ...base.submission, answers: { primary_goal: "muscle", extra: "yes" } },
      fields: [
        ...base.fields,
        { sectionKey: "goals", sectionTitle: "Goals", fieldKey: "extra", fieldLabel: "Extra", fieldType: "short_text" },
      ],
    });
    const tab = Object.keys(sheets.store.get("wb") ?? {}).find((name) => name.includes("[111111]"));
    expect(tab).toBeTruthy();
    const rows = sheets.store.get("wb")?.[tab ?? ""] ?? [];
    expect(rows[0]).toContain("primary_goal");
    expect(rows[0]).toContain("extra");
    expect(rows.filter((row) => row[0] === "s1")).toHaveLength(1);
    expect(parseSpreadsheetId("https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuv/edit")).toBe(
      "abcdefghijklmnopqrstuv",
    );
    const denied = await dest.deliver({ ...connection, config: { spreadsheetId: "missing" } }, base);
    expect(denied.reconnect).toBe(true);
  });
});
