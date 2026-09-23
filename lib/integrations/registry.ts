import { decryptJson } from "./crypto";
import { GoogleSheetsDestination } from "./destinations/google-sheets";
import { WebhookDestination } from "./destinations/webhook";
import { createGoogleSheetsApi } from "./google-api";
import { decryptGoogleTokens, refreshGoogleTokens, type GoogleOAuthTokens } from "./google-oauth";
import type { IntegrationContext, SubmissionDestination } from "./types";

export type DestinationOptions = {
  webhookFetch?: typeof fetch;
  googleSheets?: GoogleSheetsDestination;
  persistGoogleTokens?: (tokens: GoogleOAuthTokens) => Promise<void>;
};

export function destinationFor(integration: IntegrationContext, options?: DestinationOptions): SubmissionDestination {
  if (integration.type === "webhook") {
    return new WebhookDestination(options?.webhookFetch ?? fetch);
  }
  if (integration.type === "google_sheets") {
    if (options?.googleSheets) return options.googleSheets;
    return {
      async deliver(context, payload) {
        let tokens = (context.credentials ?? {}) as GoogleOAuthTokens;
        if (tokens.refresh_token && (!tokens.access_token || (tokens.expiry_date && tokens.expiry_date < Date.now() + 30_000))) {
          tokens = await refreshGoogleTokens(tokens);
          await options?.persistGoogleTokens?.(tokens);
        }
        return new GoogleSheetsDestination(createGoogleSheetsApi(tokens)).deliver({ ...context, credentials: tokens }, payload);
      },
    };
  }
  return {
    async deliver() {
      return { ok: false, error: "unsupported_integration" };
    },
  };
}

export function decryptIntegrationCredentials(type: IntegrationContext["type"], blob: string | null) {
  if (!blob) return null;
  if (type === "google_sheets") return decryptGoogleTokens(blob) as unknown as Record<string, unknown>;
  return decryptJson<Record<string, unknown>>(blob);
}
