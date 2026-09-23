"use client";
import { OnboardingRenderer } from "@/app/onboarding/OnboardingRenderer";
import type { FormField, OnboardingSchema } from "@/lib/onboarding/schema/types";
const base = { required: false, position: 0 };
const fields: FormField[] = [
  { ...base, id: "number", key: "number", type: "number", label: "Optional decimal", validation: { min: 0, max: 100 } },
  { ...base, id: "boolean", key: "boolean", type: "boolean", label: "Would you like to share more?", required: true },
  { ...base, id: "details", key: "details", type: "long_text", label: "Tell your coach what you would like them to understand about your routine, preferences, and anything that makes your week different.", logic: { action: "show", all: [{ fieldKey: "boolean", operator: "equals", value: true }] } },
  { ...base, id: "scale", key: "scale", type: "scale", label: "How confident do you feel?", min: 0, max: 10, lowLabel: "Not yet confident", highLabel: "Very confident" },
  { ...base, id: "choice", key: "choice", type: "single_select", label: "Optional preference", options: [{ label: "Morning", value: "morning" }, { label: "Evening", value: "evening" }] },
  { ...base, id: "unit", key: "unit", type: "unit_number", label: "Optional distance", unitKey: "distance_unit", defaultUnit: "km", units: [{ label: "km", value: "km", min: 0, max: 100 }, { label: "mi", value: "mi", min: 0, max: 100 }] },
];
const schema: OnboardingSchema = { id: "controls", schemaVersion: "test", title: "Control coverage", brandName: "Coaching", storageKey: "onboarding_controls_test", intro: { title: "Control coverage", navLabel: "Welcome", description: ["Development-only accessibility and control coverage."], buttonLabel: "Start" }, sections: [{ id: "controls", key: "controls", title: "A little context", position: 0, fields }], success: { title: "Complete", message: [], aside: "" } };
export function ControlsPreview() { return <OnboardingRenderer schema={schema} branding={{ primaryColor: "#EEEE99" }} mode="preview" persistAnswers={false} onSubmit={async () => undefined} />; }
