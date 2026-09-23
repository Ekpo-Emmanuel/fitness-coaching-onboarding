import { loadEnvConfig } from "@next/env";
import { WebhookDestination } from "../lib/integrations/destinations/webhook";

loadEnvConfig(process.cwd());

/**
 * Optional developer smoke. Never runs in CI. Sends a synthetic integration.test-shaped onboarding.submitted fixture.
 * Usage: npm run test:webhook-live -- --url=https://example.com/hook
 * Optional: WEBHOOK_LIVE_SECRET
 */
async function main() {
  const urlArg = process.argv.find((item) => item.startsWith("--url="))?.slice(6) || process.env.WEBHOOK_LIVE_URL;
  if (!urlArg) throw new Error("Pass --url=<https endpoint> or set WEBHOOK_LIVE_URL.");
  const secret = process.env.WEBHOOK_LIVE_SECRET || "live-smoke-secret";
  const dest = new WebhookDestination();
  const now = new Date().toISOString();
  const result = await dest.deliver(
    {
      id: "live",
      workspaceId: "live",
      type: "webhook",
      name: "Live",
      status: "connected",
      config: { endpointUrl: urlArg },
      credentials: { signingSecret: secret },
    },
    {
      event: "onboarding.submitted",
      payloadVersion: "1",
      deliveryId: "live-test",
      occurredAt: now,
      client: { id: "live-client", fullName: "Fixture Client", email: "fixture@example.test" },
      form: { id: "00000000-0000-4000-8000-000000000001", name: "Live Smoke", versionNumber: 1 },
      submission: { id: "live-sub", submittedAt: now, reviewStatus: "new", answers: { smoke: "ok" } },
      reviewFlags: [],
      fields: [],
    },
  );
  if (!result.ok) throw new Error(result.error ?? "Live webhook failed.");
  console.info("Webhook live smoke passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
