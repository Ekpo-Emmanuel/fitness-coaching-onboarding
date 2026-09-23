import type { DeliveryResult, IntegrationContext, SubmissionDestination } from "../types";
import type { OnboardingSubmittedEventV1 } from "../types";
import { log } from "@/lib/observability/log";

export type GoogleSheetMeta = { spreadsheetId: string; title: string; sheets: string[] };

export type GoogleSheetsApi = {
  getSpreadsheet(spreadsheetId: string): Promise<GoogleSheetMeta>;
  createSpreadsheet(title: string): Promise<GoogleSheetMeta>;
  addSheet(spreadsheetId: string, title: string): Promise<void>;
  getValues(spreadsheetId: string, range: string): Promise<string[][]>;
  updateValues(spreadsheetId: string, range: string, values: string[][]): Promise<void>;
  appendValues(spreadsheetId: string, range: string, values: string[][]): Promise<void>;
};

const CLIENTS_TAB = "ONBOARDING_CLIENTS";
const FIELD_MAP_TAB = "ONBOARDING_FIELD_MAP";
const SYSTEM_COLUMNS = [
  "submission_id",
  "submitted_at",
  "client_id",
  "client_name",
  "client_email",
  "client_phone",
  "form_version",
  "review_status",
  "review_flags",
];
const CLIENT_COLUMNS = [
  "client_id",
  "full_name",
  "email",
  "phone",
  "latest_submission_id",
  "latest_submission_at",
  "latest_form",
  "latest_review_status",
];
const FIELD_MAP_COLUMNS = [
  "form_id",
  "form_name",
  "form_version",
  "section_key",
  "section_title",
  "field_key",
  "field_label",
  "field_type",
];

export function formTabName(formName: string, formId: string) {
  const suffix = formId.replace(/-/g, "").slice(0, 6);
  const base = formName.replace(/[\[\]]/g, "").trim().slice(0, 80) || "Form";
  return `${base} [${suffix}]`;
}

function cell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export class GoogleSheetsDestination implements SubmissionDestination {
  constructor(private api: GoogleSheetsApi) {}

  async deliver(integration: IntegrationContext, payload: Record<string, unknown>): Promise<DeliveryResult> {
    const spreadsheetId = String(integration.config.spreadsheetId ?? "");
    if (!spreadsheetId) return { ok: false, error: "spreadsheet_not_configured" };
    const event = payload as OnboardingSubmittedEventV1;
    try {
      const meta = await this.api.getSpreadsheet(spreadsheetId);
      const tab = formTabName(event.form.name, event.form.id);
      await this.ensureTab(spreadsheetId, meta.sheets, CLIENTS_TAB);
      await this.ensureTab(spreadsheetId, meta.sheets, FIELD_MAP_TAB);
      await this.ensureTab(spreadsheetId, meta.sheets, tab);
      const answerKeys = Object.keys(event.submission.answers);
      await this.ensureHeaders(spreadsheetId, tab, [...SYSTEM_COLUMNS, ...answerKeys]);
      await this.ensureHeaders(spreadsheetId, CLIENTS_TAB, CLIENT_COLUMNS);
      await this.ensureHeaders(spreadsheetId, FIELD_MAP_TAB, FIELD_MAP_COLUMNS);
      await this.upsertSubmission(spreadsheetId, tab, event);
      await this.upsertClient(spreadsheetId, event);
      await this.appendFieldMap(spreadsheetId, event);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "google_sheet_unavailable";
      if (/invalid_grant|revoked|unauthorized|403|401/i.test(message)) {
        log.error("google_sheet_access_denied", { integrationId: integration.id });
        return { ok: false, error: "spreadsheet_access_denied", reconnect: true };
      }
      return { ok: false, error: message.slice(0, 180) };
    }
  }

  private async ensureTab(spreadsheetId: string, sheets: string[], title: string) {
    if (sheets.includes(title)) return;
    await this.api.addSheet(spreadsheetId, title);
    sheets.push(title);
  }

  private async ensureHeaders(spreadsheetId: string, tab: string, required: string[]) {
    const existing = (await this.api.getValues(spreadsheetId, `'${tab}'!1:1`))[0] ?? [];
    if (existing.length === 0) {
      await this.api.updateValues(spreadsheetId, `'${tab}'!A1`, [required]);
      return;
    }
    const missing = required.filter((key) => !existing.includes(key));
    if (!missing.length) return;
    const next = [...existing, ...missing];
    await this.api.updateValues(spreadsheetId, `'${tab}'!A1`, [next]);
  }

  private async upsertSubmission(
    spreadsheetId: string,
    tab: string,
    event: OnboardingSubmittedEventV1,
  ) {
    const headers = (await this.api.getValues(spreadsheetId, `'${tab}'!1:1`))[0] ?? [];
    const rows = await this.api.getValues(spreadsheetId, `'${tab}'!A2:A`);
    let rowNumber = -1;
    rows.forEach((row, index) => {
      if (row[0] === event.submission.id) rowNumber = index + 2;
    });
    const byHeader = (key: string) => {
      if (SYSTEM_COLUMNS.includes(key)) {
        const map: Record<string, string> = {
          submission_id: event.submission.id,
          submitted_at: event.submission.submittedAt,
          client_id: event.client.id,
          client_name: event.client.fullName,
          client_email: event.client.email,
          client_phone: event.client.phone ?? "",
          form_version: String(event.form.versionNumber),
          review_status: event.submission.reviewStatus,
          review_flags: event.reviewFlags.map((flag) => flag.code).join(","),
        };
        return map[key] ?? "";
      }
      return cell(event.submission.answers[key]);
    };
    const line = headers.map((header) => byHeader(header));
    if (rowNumber > 0) {
      await this.api.updateValues(spreadsheetId, `'${tab}'!A${rowNumber}`, [line]);
      return;
    }
    await this.api.appendValues(spreadsheetId, `'${tab}'!A1`, [line]);
  }

  private async upsertClient(spreadsheetId: string, event: OnboardingSubmittedEventV1) {
    const rows = await this.api.getValues(spreadsheetId, `'${CLIENTS_TAB}'!A2:A`);
    let rowNumber = -1;
    rows.forEach((row, index) => {
      if (row[0] === event.client.id) rowNumber = index + 2;
    });
    const line = [
      event.client.id,
      event.client.fullName,
      event.client.email,
      event.client.phone ?? "",
      event.submission.id,
      event.submission.submittedAt,
      event.form.name,
      event.submission.reviewStatus,
    ];
    if (rowNumber > 0) {
      await this.api.updateValues(spreadsheetId, `'${CLIENTS_TAB}'!A${rowNumber}`, [line]);
      return;
    }
    await this.api.appendValues(spreadsheetId, `'${CLIENTS_TAB}'!A1`, [line]);
  }

  private async appendFieldMap(spreadsheetId: string, event: OnboardingSubmittedEventV1) {
    const existing = await this.api.getValues(spreadsheetId, `'${FIELD_MAP_TAB}'!A2:F`);
    const seen = new Set(existing.map((row) => `${row[0]}|${row[2]}|${row[5]}`));
    const additions: string[][] = [];
    for (const field of event.fields ?? []) {
      const stamp = `${event.form.id}|${event.form.versionNumber}|${field.fieldKey}`;
      if (seen.has(stamp)) continue;
      additions.push([
        event.form.id,
        event.form.name,
        String(event.form.versionNumber),
        field.sectionKey,
        field.sectionTitle,
        field.fieldKey,
        field.fieldLabel,
        field.fieldType,
      ]);
    }
    if (additions.length) await this.api.appendValues(spreadsheetId, `'${FIELD_MAP_TAB}'!A1`, additions);
  }
}

export function parseSpreadsheetId(input: string) {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fromUrl) return fromUrl[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}
