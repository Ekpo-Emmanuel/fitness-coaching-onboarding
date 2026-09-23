import { loadEnvConfig } from "@next/env";
import { GoogleSheetsDestination } from "../lib/integrations/destinations/google-sheets";
import { createGoogleSheetsApi } from "../lib/integrations/google-api";
import { googleOAuthConfigured, refreshGoogleTokens, type GoogleOAuthTokens } from "../lib/integrations/google-oauth";

loadEnvConfig(process.cwd());

/**
 * Optional developer smoke. Never runs in CI. Does not send real client data.
 *
 * Required:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_LIVE_REFRESH_TOKEN
 *   GOOGLE_LIVE_SPREADSHEET_ID   (a disposable test workbook)
 *
 * Usage: npm run test:google-destination-live
 */
async function main() {
  if (!googleOAuthConfigured()) throw new Error("GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are required.");
  const refresh = process.env.GOOGLE_LIVE_REFRESH_TOKEN?.trim();
  const spreadsheetId = process.env.GOOGLE_LIVE_SPREADSHEET_ID?.trim();
  if (!refresh || !spreadsheetId) {
    throw new Error("Set GOOGLE_LIVE_REFRESH_TOKEN and GOOGLE_LIVE_SPREADSHEET_ID. Do not use a production client workbook.");
  }
  const tokens: GoogleOAuthTokens = await refreshGoogleTokens({ refresh_token: refresh });
  const dest = new GoogleSheetsDestination(createGoogleSheetsApi(tokens));
  const now = new Date().toISOString();
  const result = await dest.deliver(
    {
      id: "live",
      workspaceId: "live",
      type: "google_sheets",
      name: "Live",
      status: "connected",
      config: { spreadsheetId },
      credentials: tokens,
    },
    {
      event: "onboarding.submitted",
      payloadVersion: "1",
      deliveryId: "live-test",
      occurredAt: now,
      client: { id: "live-client", fullName: "Fixture Client", email: "fixture@example.test" },
      form: { id: "00000000-0000-4000-8000-000000000001", name: "Live Smoke", versionNumber: 1 },
      submission: {
        id: `live-${Date.now()}`,
        submittedAt: now,
        reviewStatus: "new",
        answers: { smoke: "ok" },
      },
      reviewFlags: [],
      fields: [{ sectionKey: "test", sectionTitle: "Test", fieldKey: "smoke", fieldLabel: "Smoke", fieldType: "short_text" }],
    },
  );
  if (!result.ok) throw new Error(result.error ?? "Live Google delivery failed.");
  console.info("Google destination live smoke passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
