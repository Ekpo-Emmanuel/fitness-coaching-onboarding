"use client";

import { useState } from "react";
import { OnboardingRenderer } from "@/app/onboarding/OnboardingRenderer";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";

export function FormPreview({
  schema,
  branding,
}: {
  schema: OnboardingSchema;
  branding: { businessName: string; coachName: string; primaryColor: string | null };
}) {
  const [viewport, setViewport] = useState<"mobile" | "desktop">("mobile");
  return (
    <div className="form-preview">
      <div className="preview-toolbar">
        <button
          type="button"
          className={`rounded-full px-4 py-2 ${viewport === "mobile" ? "bg-accent text-surface" : "border border-line"}`}
          aria-pressed={viewport === "mobile"}
          onClick={() => setViewport("mobile")}
        >
          Mobile
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-2 ${viewport === "desktop" ? "bg-accent text-surface" : "border border-line"}`}
          aria-pressed={viewport === "desktop"}
          onClick={() => setViewport("desktop")}
        >
          Desktop
        </button>
      </div>
      <div className="preview-frame" data-viewport={viewport}>
        <OnboardingRenderer
          schema={schema}
          mode="preview"
          persistAnswers={false}
          branding={branding}
          onSubmit={async () => undefined}
        />
      </div>
    </div>
  );
}
