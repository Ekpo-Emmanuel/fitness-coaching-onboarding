import { describe, expect, it } from "vitest";
import { fieldHint, presentSectionFields } from "@/lib/onboarding/schema/presentation";
import type { FormField } from "@/lib/onboarding/schema/types";

function text(partial: Partial<FormField> & { key: string; label: string }): FormField {
  return {
    id: partial.key,
    type: "short_text",
    required: false,
    position: 0,
    ...partial,
  } as FormField;
}

describe("presentSectionFields", () => {
  it("clusters consecutive identity fields", () => {
    const groups = presentSectionFields(
      [
        text({ key: "full_name", label: "Full name", type: "short_text" }),
        text({ key: "email", label: "Email", type: "email" }),
        text({ key: "phone", label: "Phone", type: "phone" }),
        text({ key: "goal", label: "What is your main fitness goal?", type: "long_text", required: true }),
      ],
      {},
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].map((field) => field.key)).toEqual(["full_name", "email", "phone"]);
    expect(groups[1].map((field) => field.key)).toEqual(["goal"]);
  });

  it("keeps schema groups together", () => {
    const groups = presentSectionFields(
      [
        text({ key: "a", label: "A", group: "macros" }),
        text({ key: "b", label: "B", group: "macros" }),
        text({ key: "c", label: "C" }),
      ],
      {},
    );
    expect(groups[0].map((field) => field.key)).toEqual(["a", "b"]);
    expect(groups[1].map((field) => field.key)).toEqual(["c"]);
  });
});

describe("fieldHint", () => {
  it("uses schema description first", () => {
    expect(fieldHint(text({ key: "pain", label: "Pain", description: "In your own words." }))).toBe("In your own words.");
  });

  it("adds a calm helper for unlabeled sensitive questions", () => {
    expect(fieldHint(text({ key: "current_injury", label: "Any current injuries?" }))).toBe(
      "Your coach should know this before working with you.",
    );
  });
});
