"use client";

import { useState } from "react";

export function ConnectionsSandbox() {
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState("Failed");
  const [connected, setConnected] = useState(true);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl tracking-tight">Connections</h1>
      <p className="mt-3 text-muted">New onboarding submissions will be sent to this destination.</p>
      <section className="mt-8 rounded-[1.5rem] border border-line p-6">
        <h2 className="font-display text-2xl tracking-tight">Google Sheets</h2>
        <p>{connected ? "Connected" : "Not connected"}</p>
        <p className="text-muted">Spreadsheet: Client Onboarding Data</p>
      </section>
      <section className="mt-6 rounded-[1.5rem] border border-line p-6">
        <h2 className="font-display text-2xl tracking-tight">Webhooks</h2>
        <button
          type="button"
          className="mt-3 rounded-full bg-accent px-5 py-2 text-sm text-surface"
          onClick={() => setSecret("test-secret-once")}
        >
          Add webhook
        </button>
        {secret ? <code className="mt-3 block">{secret}</code> : null}
        <p className="mt-2">Connected</p>
        <p className="text-muted">https://hooks.example.test/onboarding</p>
      </section>
      <section className="mt-6">
        <h2 className="font-display text-2xl tracking-tight">Recent deliveries</h2>
        <p className="mt-2">onboarding.submitted · {status}</p>
        {status === "Failed" ? (
          <p>Delivery failed. Your client&apos;s onboarding is safely stored. HTTP 500</p>
        ) : null}
        <button type="button" className="mt-3 underline" onClick={() => setStatus("Sent")}>
          Retry
        </button>
      </section>
      <button type="button" className="mt-6 text-sm" onClick={() => setConnected(false)}>
        Disconnect
      </button>
    </main>
  );
}
