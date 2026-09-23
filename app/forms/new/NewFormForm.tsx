"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createFormAction } from "@/lib/forms/actions";

export function NewFormForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [source, setSource] = useState<"ai" | "blank" | "v1">("ai");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await createFormAction({ name, source: source === "v1" ? "v1" : "blank" });
    setPending(false);
    if ("formId" in result && result.formId) {
      router.push(source === "ai" ? `/forms/${result.formId}/build?agent=1` : `/forms/${result.formId}/build`);
      return;
    }
    setError("error" in result ? result.error : "Could not create the onboarding.");
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 max-w-xl space-y-6">
      <label className="block">
        <span className="font-display text-sm tracking-tight">Form name</span>
        <input
          className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Muscle-building onboarding"
          required
        />
      </label>
      <fieldset className="space-y-3">
        <legend className="font-display text-sm tracking-tight">Start from</legend>
        <label className="create-choice">
          <input type="radio" name="source" checked={source === "ai"} onChange={() => setSource("ai")} />
          <span>
            <strong className="font-display">Create with AI</strong>
            <span className="ml-2 font-mono text-[0.65rem] tracking-[0.16em] text-muted uppercase">Recommended</span>
            <span className="mt-1 block text-sm text-muted">
              Describe your clients and coaching style. Review every proposal before applying it.
            </span>
          </span>
        </label>
        <label className="create-choice">
          <input type="radio" name="source" checked={source === "blank"} onChange={() => setSource("blank")} />
          <span>
            <strong className="font-display">Start manually</strong>
            <span className="mt-1 block text-sm text-muted">Welcome, about you, and a final check. Edit in the visual builder.</span>
          </span>
        </label>
        <label className="create-choice">
          <input type="radio" name="source" checked={source === "v1"} onChange={() => setSource("v1")} />
          <span>
            <strong className="font-display">Start from current onboarding</strong>
            <span className="mt-1 block text-sm text-muted">Use the existing onboarding as a starting point. Make this new form your own.</span>
          </span>
        </label>
      </fieldset>
      {error ? (
        <p className="rounded-2xl bg-warn-soft px-4 py-3 text-warn" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-6 py-3 font-display text-surface transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Creating…" : source === "ai" ? "Create and open Agent" : "Create onboarding"}
      </button>
    </form>
  );
}
