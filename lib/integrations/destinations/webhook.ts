import { FormServiceError } from "@/lib/forms/errors";
import { log } from "@/lib/observability/log";
import { assertSafeWebhookUrl, webhookHttpAllowed } from "../ssrf";
import { signWebhookBody } from "../webhook-sign";
import type { DeliveryResult, IntegrationContext, SubmissionDestination } from "../types";

const TIMEOUT_MS = 4_000;

export class WebhookDestination implements SubmissionDestination {
  constructor(private fetchImpl: typeof fetch = fetch) {}

  async deliver(integration: IntegrationContext, payload: Record<string, unknown>): Promise<DeliveryResult> {
    const endpoint = String(integration.config.endpointUrl ?? "");
    const secret = String(integration.credentials?.signingSecret ?? "");
    if (!endpoint || !secret) return { ok: false, error: "webhook_not_configured" };
    try {
      await assertSafeWebhookUrl(endpoint, { allowHttpLocal: webhookHttpAllowed() });
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "invalid_webhook_url" };
    }
    const rawBody = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(endpoint, {
        method: "POST",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "X-Onboarding-Event": String(payload.event ?? "onboarding.submitted"),
          "X-Onboarding-Delivery-Id": String(payload.deliveryId ?? ""),
          "X-Onboarding-Timestamp": timestamp,
          "X-Onboarding-Signature": signWebhookBody(secret, timestamp, rawBody),
        },
        body: rawBody,
      });
      if (response.status >= 300 && response.status < 400) {
        return { ok: false, error: "redirect_not_followed" };
      }
      if (response.status >= 200 && response.status < 300) return { ok: true };
      return { ok: false, error: `HTTP ${response.status}` };
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "AbortError" || name === "TimeoutError") {
        log.error("webhook_timeout", { integrationId: integration.id });
        return { ok: false, error: "timeout" };
      }
      return { ok: false, error: "webhook_unavailable" };
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function validateWebhookEndpoint(url: string) {
  try {
    return await assertSafeWebhookUrl(url, { allowHttpLocal: webhookHttpAllowed() });
  } catch (error) {
    throw new FormServiceError(error instanceof Error ? error.message : "Enter a valid webhook URL.");
  }
}
