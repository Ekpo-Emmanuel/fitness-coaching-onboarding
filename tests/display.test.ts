import { describe, expect, it } from "vitest";
import { formatAnswerValue } from "@/lib/submissions/display";
import type { FormField } from "@/lib/onboarding/schema/types";

describe("submission display", () => {
  it("formats height as feet and inches", () => {
    const field: FormField = {
      id: "fld_height_value",
      key: "height_value",
      type: "unit_number",
      label: "Height",
      required: true,
      position: 0,
      unitKey: "height_unit",
      companionKey: "height_inches",
      defaultUnit: "cm",
      units: [
        { value: "cm", label: "cm", min: 100, max: 250 },
        { value: "ft_in", label: "ft / in", min: 3, max: 8, companion: { min: 0, max: 11.9 } },
      ],
    };
    expect(
      formatAnswerValue(field, {
        height_value: "6",
        height_unit: "ft_in",
        height_inches: "2",
      }),
    ).toBe("6 ft 2 in");
  });

  it("formats weight with unit", () => {
    const field: FormField = {
      id: "fld_weight_value",
      key: "weight_value",
      type: "unit_number",
      label: "Weight",
      required: true,
      position: 0,
      unitKey: "weight_unit",
      defaultUnit: "lb",
      units: [
        { value: "lb", label: "lb", min: 70, max: 500 },
        { value: "kg", label: "kg", min: 30, max: 230 },
      ],
    };
    expect(formatAnswerValue(field, { weight_value: "185", weight_unit: "lb" })).toBe("185 lb");
  });
});
