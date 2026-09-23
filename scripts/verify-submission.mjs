import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";

const root = path.resolve(import.meta.dirname, "..");
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

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const id = process.argv[2];

function find(values, submissionId) {
  const [headers, ...rows] = values ?? [];
  if (!headers) return null;
  const idx = headers.indexOf("submission_id");
  const row = rows.find((item) => item[idx] === submissionId);
  if (!row) return null;
  const record = {};
  headers.forEach((header, i) => {
    record[header] = row[i] ?? "";
  });
  return record;
}

const [clients, responses, fieldMap] = await Promise.all([
  sheets.spreadsheets.values.get({ spreadsheetId, range: "CLIENTS!A1:Z" }),
  sheets.spreadsheets.values.get({ spreadsheetId, range: "ONBOARDING_RESPONSES!A1:C" }),
  sheets.spreadsheets.values.get({ spreadsheetId, range: "FIELD_MAP!A1:A" }),
]);

const client = find(clients.data.values, id);
const response = find(responses.data.values, id);
console.log("clients_row", Boolean(client));
console.log("responses_row", Boolean(response));
console.log("field_map_rows", (fieldMap.data.values?.length ?? 0) - 1);
if (client) {
  console.log("name", client.full_name);
  console.log("health_flag", client.health_flag);
  console.log("status", client.onboarding_status);
  console.log("days", client.training_days_available);
  console.log("weight", client.current_weight);
}
if (response) {
  console.log("schema", response.schema_version);
  console.log("submitted_at", response.submitted_at);
}
