"use client";

import { StatusBadge } from "@/components/product/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createWebhookAction,
  disconnectGoogleAction,
  retryDeliveryAction,
  retryFailedAction,
  rotateWebhookAction,
  saveSpreadsheetAction,
  setStatusAction,
  testGoogleAction,
  testWebhookAction,
} from "@/lib/integrations/actions";

type PublicIntegration = {
  id: string;
  type: "google_sheets" | "webhook";
  name: string;
  status: "connected" | "disabled" | "error";
  lastError: string | null;
  updatedAt: Date | string;
  spreadsheetId: string | null;
  spreadsheetTitle: string | null;
  endpointUrl: string | null;
};

type PublicDelivery = {
  id: string;
  integrationId: string;
  submissionId: string;
  eventType: string;
  status: string;
  attemptCount: number;
  lastAttemptAt: Date | string | null;
  lastError: string | null;
  clientId: string | null;
};

function statusLabel(status: string) {
  if (status === "connected") return "Connected";
  if (status === "disabled") return "Disabled";
  if (status === "error") return "Needs attention";
  if (status === "pending") return "Pending";
  if (status === "processing") return "Sending";
  if (status === "sent") return "Sent";
  if (status === "failed") return "Failed";
  return status;
}

export function ConnectionsClient({
  googleConfigured,
  integrations,
  deliveries,
}: {
  googleConfigured: boolean;
  integrations: PublicIntegration[];
  deliveries: PublicDelivery[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState("");
  const [webhookName, setWebhookName] = useState("Webhook");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [sheetInput, setSheetInput] = useState("");
  const google = integrations.find((item) => item.type === "google_sheets");
  const webhooks = integrations.filter((item) => item.type === "webhook");

  async function refresh() {
    router.refresh();
  }

  return (
    <div className="connections-content">
      <p className="max-w-[60ch] text-muted">
        New onboarding submissions will be sent to this destination. Onboarding can include health-related information.
      </p>
      {message ? <p role="status" className="connection-feedback">{message}</p> : null}
      {secret ? (
        <aside className="rounded-2xl border border-line bg-surface p-5">
          <p className="font-display text-xl tracking-tight">Copy this signing secret now</p>
          <p className="mt-2 text-sm text-muted">It will not be shown again. Use HMAC-SHA256 over timestamp + &quot;.&quot; + raw body.</p>
          <code className="mt-3 block break-all rounded-xl bg-accent-soft px-3 py-2 text-sm">{secret}</code>
        </aside>
      ) : null}

      <section className="connection-card">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">Google Sheets</p>
        <h2 className="mt-2 font-display text-3xl tracking-tight">Google Sheets</h2>
        <StatusBadge status={google?.status || "disabled"}>{google ? statusLabel(google.status) : "Not connected"}</StatusBadge>
        {google?.spreadsheetTitle ? <p className="mt-1 text-muted">Spreadsheet: {google.spreadsheetTitle}</p> : null}
        {!googleConfigured ? (
          <p className="mt-4 text-muted">Google Sheets is not available in this workspace yet. Contact your workspace administrator.</p>
        ) : !google || google.status === "disabled" ? (
          <a href="/api/integrations/google/start" className="mt-4 inline-flex rounded-full bg-accent px-5 py-2 text-sm text-surface">
            Connect Google Sheets
          </a>
        ) : (
          <div className="mt-4 space-y-3">
            {google.status === "error" ? (
              <a href="/api/integrations/google/start" className="inline-flex rounded-full bg-accent px-5 py-2 text-sm text-surface">
                Reconnect Google Sheets
              </a>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <input
                aria-label="Spreadsheet URL or ID"
                className="min-w-0 flex-1 rounded-2xl border border-line px-4 py-2"
                placeholder="Spreadsheet URL or ID"
                value={sheetInput}
                onChange={(event) => setSheetInput(event.target.value)}
              />
              <button
                type="button"
                className="rounded-full border border-line px-4 py-2 text-sm"
                onClick={async () => {
                  const result = await saveSpreadsheetAction(google.id, { spreadsheetId: sheetInput });
                  setMessage("error" in result ? result.error : "Spreadsheet saved.");
                  await refresh();
                }}
              >
                Use existing
              </button>
              <button
                type="button"
                className="rounded-full border border-line px-4 py-2 text-sm"
                onClick={async () => {
                  const result = await saveSpreadsheetAction(google.id, { create: true });
                  setMessage("error" in result ? result.error : "Created onboarding spreadsheet.");
                  await refresh();
                }}
              >
                Create onboarding spreadsheet
              </button>
            </div>
            {google.spreadsheetId ? (
              <a
                className="inline-block text-sm underline"
                href={`https://docs.google.com/spreadsheets/d/${google.spreadsheetId}`}
                target="_blank"
                rel="noreferrer"
              >
                Open spreadsheet
              </a>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-line px-4 py-2 text-sm"
                onClick={async () => {
                  const result = await testGoogleAction(google.id);
                  setMessage("error" in result ? result.error : `Connected to ${result.title}.`);
                }}
              >
                Test connection
              </button>
              <button
                type="button"
                className="rounded-full border border-line px-4 py-2 text-sm"
                onClick={async () => {
                  const result = await disconnectGoogleAction(google.id);
                  setMessage("error" in result ? result.error : "Google Sheets disconnected. Submissions stay in this product.");
                  await refresh();
                }}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-line bg-surface p-6">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">Webhooks</p>
        <h2 className="mt-2 font-display text-3xl tracking-tight">Signed webhooks</h2>
        <p className="mt-2 max-w-[60ch] text-sm text-muted">
          POST JSON to your endpoint. Headers: X-Onboarding-Event, X-Onboarding-Delivery-Id, X-Onboarding-Timestamp,
          X-Onboarding-Signature (v1=HMAC-SHA256 of timestamp + &quot;.&quot; + raw body). Treat 2xx as success.
          Receivers should reject timestamps older than 5 minutes, reconstruct the exact raw body, and compare HMAC with a timing-safe function.
        </p>
        <form
          className="webhook-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await createWebhookAction({ name: webhookName, endpointUrl: webhookUrl });
            if ("signingSecret" in result) {
              setSecret(result.signingSecret);
              setMessage("Webhook added. Copy the signing secret.");
              setWebhookUrl("");
              await refresh();
              return;
            }
            setMessage(result.error);
          }}
        >
          <input
            className="rounded-2xl border border-line px-4 py-2"
            aria-label="Webhook name"
            required
            value={webhookName}
            onChange={(event) => setWebhookName(event.target.value)}
            placeholder="Name"
          />
          <input
            className="rounded-2xl border border-line px-4 py-2"
            aria-label="HTTPS endpoint URL"
            type="url"
            required
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value)}
            placeholder="https://hooks.example.com/onboarding"
          />
          <button type="submit" className="rounded-full bg-accent px-5 py-2 text-sm text-surface">
            Add webhook
          </button>
        </form>
        <ul className="mt-6 space-y-4">
          {webhooks.map((hook) => (
            <li key={hook.id} className="rounded-2xl border border-line p-4">
              <p className="font-display text-xl tracking-tight">{hook.name}</p>
              <StatusBadge status={hook.status} />
              <p className="text-sm text-muted">{hook.endpointUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-line px-3 py-1 text-sm"
                  onClick={async () => {
                    const result = await testWebhookAction(hook.id);
                    setMessage("error" in result ? result.error : "Test event sent.");
                  }}
                >
                  Send test
                </button>
                <button
                  type="button"
                  className="rounded-full border border-line px-3 py-1 text-sm"
                  onClick={async () => {
                    const result = await rotateWebhookAction(hook.id);
                    if ("signingSecret" in result) {
                      setSecret(result.signingSecret);
                      setMessage("Secret rotated. Copy the new value.");
                      return;
                    }
                    setMessage(result.error);
                  }}
                >
                  Rotate secret
                </button>
                <button
                  type="button"
                  className="rounded-full border border-line px-3 py-1 text-sm"
                  onClick={async () => {
                    const next = hook.status === "connected" ? "disabled" : "connected";
                    const result = await setStatusAction(hook.id, next);
                    setMessage("error" in result ? result.error : `Webhook ${next === "disabled" ? "disabled" : "enabled"}.`);
                    await refresh();
                  }}
                >
                  {hook.status === "connected" ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-line px-3 py-1 text-sm"
                  onClick={async () => {
                    await retryFailedAction(hook.id);
                    await refresh();
                  }}
                >
                  Retry all failed
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="delivery-history">
        <h2 className="font-display text-3xl tracking-tight">Recent deliveries</h2>
        {deliveries.length === 0 ? (
          <p className="mt-3 text-muted">No deliveries yet. Future public form submissions will appear here.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-[1.5rem] border border-line bg-surface">
            {deliveries.map((item) => {
              return (
                <li key={item.id} className="px-5 py-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-display text-lg tracking-tight">{item.eventType}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-sm text-muted">
                    Attempts {item.attemptCount}
                    {item.lastAttemptAt ? ` · ${new Date(item.lastAttemptAt).toLocaleString()}` : ""}
                  </p>
                  {item.status === "failed" ? (
                    <p className="mt-2 text-sm">
                      Delivery failed. Your client&apos;s onboarding is safely stored.
                      {item.lastError ? ` ${item.lastError}` : ""}
                    </p>
                  ) : null}
                  <div className="mt-2 flex gap-3 text-sm">
                    {item.clientId ? (
                      <a className="underline" href={`/clients/${item.clientId}/submissions/${item.submissionId}`}>
                        Submission
                      </a>
                    ) : null}
                    {item.status === "failed" || item.status === "pending" ? (
                      <button
                        type="button"
                        className="underline"
                        onClick={async () => {
                          const result = await retryDeliveryAction(item.id);
                          setMessage("error" in result ? result.error : `Delivery ${result.status}.`);
                          await refresh();
                        }}
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
