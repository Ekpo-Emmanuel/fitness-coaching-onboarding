"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WorkspaceDangerZone() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    setBusy(true);
    const response = await fetch("/api/workspace", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!response.ok) {
      setError(payload?.error || "Could not delete workspace.");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <section className="danger-zone mt-12 max-w-xl rounded-[1.5rem] border border-line p-6">
      <h2 className="font-display text-2xl tracking-tight">Delete workspace</h2>
      <p className="mt-3 text-sm text-muted">
        Owner only. Removes forms, clients, submissions, agent history, and connection credentials from this application.
        Your login account stays. Copies previously sent to Google Sheets or webhooks may need to be removed there separately.
      </p>
      <label className="mt-4 block text-sm">
        Type DELETE
        <input className="mt-1 w-full rounded-2xl border border-line px-4 py-3" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
      </label>
      {error ? (
        <p className="mt-2 text-sm text-warn" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="button button-danger mt-4"
        disabled={busy || confirm !== "DELETE"}
        onClick={() => void onDelete()}
      >
        {busy ? "Deleting…" : "Delete workspace"}
      </button>
    </section>
  );
}
