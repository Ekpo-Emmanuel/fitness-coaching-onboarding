import type { GoogleSheetsApi, GoogleSheetMeta } from "./destinations/google-sheets";
import { sheetsClientFromTokens, type GoogleOAuthTokens } from "./google-oauth";

export function createGoogleSheetsApi(tokens: GoogleOAuthTokens): GoogleSheetsApi {
  const sheets = sheetsClientFromTokens(tokens);
  return {
    async getSpreadsheet(spreadsheetId) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      return {
        spreadsheetId,
        title: meta.data.properties?.title ?? spreadsheetId,
        sheets: (meta.data.sheets ?? []).map((sheet) => sheet.properties?.title ?? "").filter(Boolean),
      } satisfies GoogleSheetMeta;
    },
    async createSpreadsheet(title) {
      const created = await sheets.spreadsheets.create({
        requestBody: { properties: { title } },
      });
      return {
        spreadsheetId: created.data.spreadsheetId ?? "",
        title: created.data.properties?.title ?? title,
        sheets: (created.data.sheets ?? []).map((sheet) => sheet.properties?.title ?? "").filter(Boolean),
      };
    },
    async addSheet(spreadsheetId, title) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      });
    },
    async getValues(spreadsheetId, range) {
      const result = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      return (result.data.values as string[][] | undefined) ?? [];
    },
    async updateValues(spreadsheetId, range, values) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    },
    async appendValues(spreadsheetId, range, values) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });
    },
  };
}
