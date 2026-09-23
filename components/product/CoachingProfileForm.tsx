"use client";

import { useState, type FormEvent } from "react";
import { completeCoachSetup, updateCoachingProfile } from "@/lib/workspace/actions";
import { COACHING_TYPE_OPTIONS, type CoachingProfileInput } from "@/lib/workspace/profile";

type Props = {
  mode: "setup" | "edit";
  initial?: Partial<CoachingProfileInput>;
};

export function CoachingProfileForm({ mode, initial }: Props) {
  const [businessName, setBusinessName] = useState(initial?.businessName ?? "");
  const [coachName, setCoachName] = useState(initial?.coachName ?? "");
  const [coachingTypes, setCoachingTypes] = useState<string[]>(initial?.coachingTypes ?? []);
  const [targetClientDescription, setTargetClientDescription] = useState(
    initial?.targetClientDescription ?? "",
  );
  const [providesNutritionCoaching, setProvidesNutritionCoaching] = useState(
    initial?.providesNutritionCoaching ?? false,
  );
  const [requiresHealthScreening, setRequiresHealthScreening] = useState(
    initial?.requiresHealthScreening ?? true,
  );
  const [coachingPhilosophy, setCoachingPhilosophy] = useState(initial?.coachingPhilosophy ?? "");
  const [programmingConsiderations, setProgrammingConsiderations] = useState(
    initial?.programmingConsiderations ?? "",
  );
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleType(value: string) {
    setCoachingTypes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");
    const payload: CoachingProfileInput = {
      businessName,
      coachName,
      coachingTypes,
      targetClientDescription,
      providesNutritionCoaching,
      requiresHealthScreening,
      coachingPhilosophy,
      programmingConsiderations,
    };
    const result =
      mode === "setup" ? await completeCoachSetup(payload) : await updateCoachingProfile(payload);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    if (mode === "edit") {
      setStatus("Saved");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="profile-form flex flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="font-display tracking-tight">Business name</span>
        <input
          value={businessName}
          onChange={(event) => setBusinessName(event.target.value)}
          className="min-h-12 rounded-2xl border border-line bg-surface px-4 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-display tracking-tight">Coach name</span>
        <input
          value={coachName}
          onChange={(event) => setCoachName(event.target.value)}
          className="min-h-12 rounded-2xl border border-line bg-surface px-4 outline-none focus:border-accent"
        />
      </label>
      <fieldset className="flex flex-col gap-3">
        <legend className="font-display tracking-tight">Coaching type</legend>
        {COACHING_TYPE_OPTIONS.map((option) => (
          <label key={option.value} className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={coachingTypes.includes(option.value)}
              onChange={() => toggleType(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-2">
        <span className="font-display tracking-tight">Who do you primarily help?</span>
        <textarea
          rows={4}
          value={targetClientDescription}
          onChange={(event) => setTargetClientDescription(event.target.value)}
          placeholder="Tell us about your clients, their goals, and the support they need."
          className="rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
        />
      </label>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="font-display tracking-tight">Nutrition coaching?</span>
          <select
            value={providesNutritionCoaching ? "yes" : "no"}
            onChange={(event) => setProvidesNutritionCoaching(event.target.value === "yes")}
            className="min-h-12 rounded-2xl border border-line bg-surface px-4 outline-none focus:border-accent"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-display tracking-tight">Health / injury screening?</span>
          <select
            value={requiresHealthScreening ? "yes" : "no"}
            onChange={(event) => setRequiresHealthScreening(event.target.value === "yes")}
            className="min-h-12 rounded-2xl border border-line bg-surface px-4 outline-none focus:border-accent"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </fieldset>
      <label className="flex flex-col gap-2">
        <span className="font-display tracking-tight">Coaching philosophy (optional)</span>
        <textarea
          rows={3}
          value={coachingPhilosophy}
          onChange={(event) => setCoachingPhilosophy(event.target.value)}
          className="rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-display tracking-tight">Programming considerations (optional)</span>
        <textarea
          rows={3}
          value={programmingConsiderations}
          onChange={(event) => setProgrammingConsiderations(event.target.value)}
          className="rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
        />
      </label>
      {error ? (
        <p className="text-warn" role="alert">
          {error}
        </p>
      ) : null}
      {status ? <p className="text-accent" role="status">Profile saved.</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="min-h-12 self-start rounded-full bg-accent px-6 font-display text-surface active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? "Saving…" : mode === "setup" ? "Create workspace" : "Save profile"}
      </button>
    </form>
  );
}
