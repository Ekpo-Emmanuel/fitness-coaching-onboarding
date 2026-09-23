import { auth as googleAuth, sheets } from "googleapis/build/src/apis/sheets";
import { FormServiceError } from "@/lib/forms/errors";
import { encryptJson, decryptJson } from "./crypto";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export type GoogleOAuthTokens = {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
};

function oauthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new FormServiceError("Google Sheets OAuth is not configured.");
  return new googleAuth.OAuth2(clientId, clientSecret, googleRedirectUri());
}

export function googleRedirectUri() {
  return (
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    `${(process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "")}/api/integrations/google/callback`
  );
}

export function googleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim());
}

export function createGoogleAuthUrl(state: string) {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [SCOPE],
    state,
  });
}

export async function exchangeGoogleCode(code: string): Promise<GoogleOAuthTokens> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  return {
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  };
}

export function encryptGoogleTokens(tokens: GoogleOAuthTokens) {
  return encryptJson(tokens);
}

export function decryptGoogleTokens(blob: string): GoogleOAuthTokens {
  return decryptJson<GoogleOAuthTokens>(blob);
}

export async function refreshGoogleTokens(tokens: GoogleOAuthTokens): Promise<GoogleOAuthTokens> {
  const client = oauthClient();
  client.setCredentials(tokens);
  const { credentials } = await client.refreshAccessToken();
  return {
    access_token: credentials.access_token ?? tokens.access_token,
    refresh_token: credentials.refresh_token ?? tokens.refresh_token,
    expiry_date: credentials.expiry_date ?? tokens.expiry_date,
  };
}

export async function revokeGoogleTokens(tokens: GoogleOAuthTokens) {
  const token = tokens.access_token || tokens.refresh_token;
  if (!token) return;
  try {
    await oauthClient().revokeToken(token);
  } catch {
    // Revocation is best-effort; disconnect still clears local credentials.
  }
}

export function sheetsClientFromTokens(tokens: GoogleOAuthTokens) {
  const client = oauthClient();
  client.setCredentials(tokens);
  return sheets({ version: "v4", auth: client });
}
