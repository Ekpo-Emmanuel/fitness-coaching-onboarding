import fs from "node:fs";

const jsonPath = process.argv[2];
const spreadsheetId = process.argv[3];
const password = process.argv[4] ?? "local-review-only";
const j = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const key = j.private_key.replace(/\n/g, "\\n");
const contents = [
  `GOOGLE_SERVICE_ACCOUNT_EMAIL=${j.client_email}`,
  `GOOGLE_PRIVATE_KEY="${key}"`,
  `GOOGLE_SHEETS_SPREADSHEET_ID=${spreadsheetId}`,
  `COACH_DASHBOARD_PASSWORD=${password}`,
  "",
].join("\n");
fs.writeFileSync(".env.local", contents);
console.log("env written", { email: j.client_email, keyChars: j.private_key.length, spreadsheetId });
