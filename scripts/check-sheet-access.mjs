import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";

const root = path.resolve(import.meta.dirname, "..");

function loadEnv() {
  const text = fs.readFileSync(path.join(root, ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index);
    let value = line.slice(index + 1);
    if (value.startsWith("\"") && value.endsWith("\"")) value = value.slice(1, -1);
    process.env[key] = value.replace(/\\n/g, "\n");
  }
}

loadEnv();

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_PRIVATE_KEY;
const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
if (!email || !key || !spreadsheetId) {
  throw new Error("Missing Google env vars.");
}

const auth = new google.auth.JWT({
  email,
  key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const meta = await sheets.spreadsheets.get({ spreadsheetId });
const titles = (meta.data.sheets ?? []).map((sheet) => sheet.properties?.title);
console.log("access_ok");
console.log("tabs", titles.join(",") || "(none)");
console.log("title", meta.data.properties?.title);
