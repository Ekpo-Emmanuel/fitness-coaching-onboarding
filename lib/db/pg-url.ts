const WEAK_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

/** pg currently treats require/prefer/verify-ca as verify-full and warns. Keep that behavior explicit. */
export function pgConnectionString(url: string) {
  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get("sslmode");
    if (!mode || WEAK_SSL_MODES.has(mode)) {
      parsed.searchParams.set("sslmode", "verify-full");
    }
    return parsed.toString();
  } catch {
    return url.replace(/([?&]sslmode=)(require|prefer|verify-ca)\b/i, "$1verify-full");
  }
}
