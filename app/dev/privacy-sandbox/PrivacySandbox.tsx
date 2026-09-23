"use client";

import { useState } from "react";

export function PrivacySandbox() {
  const [gone, setGone] = useState(false);
  const [confirm, setConfirm] = useState("");
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-4xl tracking-tight">Ada</h1>
      <p>ada@example.com</p>
      {!gone ? (
        <>
          <p>Other client remains: Beau</p>
          <label className="mt-4 block">
            Type DELETE
            <input id="confirm-delete" className="mt-1 block w-full border" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </label>
          <button type="button" disabled={confirm !== "DELETE"} onClick={() => setGone(true)}>
            Delete client data
          </button>
        </>
      ) : (
        <p>Ada removed. Beau remains.</p>
      )}
    </main>
  );
}
