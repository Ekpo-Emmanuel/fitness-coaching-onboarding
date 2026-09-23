export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function parseEncryptionKey(raw: string | undefined) {
  const value = raw?.trim() ?? "";
  if (!value) throw new ConfigError("INTEGRATION_ENCRYPTION_KEY is required. Generate one with: openssl rand -hex 32");
  if (/^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, "hex");
  const buf = Buffer.from(value, "base64");
  if (buf.length === 32) return buf;
  throw new ConfigError(
    "INTEGRATION_ENCRYPTION_KEY must be 32 cryptographically random bytes (64 hex characters, or 32-byte base64). Example: openssl rand -hex 32",
  );
}

export function validateCoreConfig() {
  if (!process.env.DATABASE_URL?.trim()) throw new ConfigError("DATABASE_URL is required.");
  if (!process.env.BETTER_AUTH_SECRET?.trim() || (process.env.BETTER_AUTH_SECRET?.length ?? 0) < 16) {
    throw new ConfigError("BETTER_AUTH_SECRET must be a long random string.");
  }
  if (!process.env.BETTER_AUTH_URL?.trim()) throw new ConfigError("BETTER_AUTH_URL is required.");
  if (isProduction() || process.env.INTEGRATION_ENCRYPTION_KEY?.trim()) {
    parseEncryptionKey(process.env.INTEGRATION_ENCRYPTION_KEY);
  }
}

export function googleOAuthReady() {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim());
}

export function openaiReady() {
  return Boolean(process.env["OPENAI_API_KEY"]?.trim());
}

export function deepseekReady() {
  return Boolean(process.env["DEEPSEEK_API_KEY"]?.trim());
}

export function legacySheetsReady() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_PRIVATE_KEY?.trim() &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim(),
  );
}

export function cronSecret() {
  return process.env.CRON_SECRET?.trim() || "";
}

export function trustProxy() {
  return process.env.TRUST_PROXY === "true" || isProduction();
}
