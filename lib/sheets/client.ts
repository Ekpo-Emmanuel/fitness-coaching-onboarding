import { auth as googleAuth, sheets } from "googleapis/build/src/apis/sheets";

/** V1 compatibility: global service-account Sheets client for `/` only. */

export class SheetsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetsConfigError";
  }
}

export function getSheetsConfig() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!email || !key || !spreadsheetId) {
    throw new SheetsConfigError("Google Sheets is not configured.");
  }

  return { email, key, spreadsheetId };
}

export function getSheetsClient() {
  const { email, key } = getSheetsConfig();
  const auth = new googleAuth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return sheets({ version: "v4", auth });
}
