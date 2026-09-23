export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NODE_ENV === "test") return;
  const { validateCoreConfig } = await import("./lib/config");
  validateCoreConfig();
}
