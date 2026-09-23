import { describe, expect, it } from "vitest";
import { questionPages, visiblePages } from "@/lib/onboarding/schema/pacing";
import { emptyAnswers, validateSectionFields } from "@/lib/onboarding/schema/engine";
import { emmanuelOnboardingV1 as schema } from "@/lib/onboarding/schemas/emmanuel-onboarding-v1";
import type { FormField } from "@/lib/onboarding/schema/types";

describe("guided onboarding", () => {
  it("preserves every field once, schema order, and published schema", () => {
    const before = JSON.stringify(schema);
    const pages = questionPages(schema);
    expect(pages.flatMap((page) => page.fields)).toEqual(schema.sections.flatMap((section) => section.fields));
    expect(JSON.stringify(schema)).toBe(before);
    expect(pages.length).toBeLessThan(30);
    expect(new Set(pages.map((page) => page.key)).size).toBe(pages.length);
  });
  it("keeps conditional injury details with the trigger", () => {
    const page = questionPages(schema).find((page) => page.fields.some((field) => field.key === "current_injuries"))!;
    expect(page.fields.some((field) => field.key === "current_injury_details")).toBe(true);
    expect(visiblePages([page], emptyAnswers(schema))).toHaveLength(1);
  });
  it("accepts blank optional controls but rejects blank required zero-based numbers", () => {
    const base = { id: "test", key: "test", label: "Test", position: 0, required: false };
    const fields: FormField[] = [
      { ...base, type: "number", validation: { min: 0, max: 10 } },
      { ...base, type: "scale", min: 0, max: 10, lowLabel: "Low", highLabel: "High" },
      { ...base, type: "single_select", options: [{ value: "a", label: "A" }] },
      { ...base, type: "boolean" },
      { ...base, type: "unit_number", unitKey: "unit", defaultUnit: "kg", units: [{ value: "kg", label: "kg", min: 0, max: 100 }] },
    ];
    for (const field of fields) {
      const section = { ...schema.sections[0], fields: [field] };
      expect(validateSectionFields(section, { test: "", unit: "kg" })).toEqual({});
      expect(validateSectionFields({ ...section, fields: [{ ...field, required: true }] }, { test: "", unit: "kg" })).toHaveProperty("test");
    }
  });
  it("requires an intentional boolean response and accepts No", () => {
    const field: FormField = { id: "b", key: "b", label: "Question", type: "boolean", required: true, position: 0 };
    const section = { ...schema.sections[0], fields: [field] };
    expect(emptyAnswers({ ...schema, sections: [section] }).b).toBe("");
    expect(validateSectionFields(section, { b: false })).toEqual({});
    expect(validateSectionFields(section, { b: "false" })).toHaveProperty("b");
  });
});
