import { describe, expect, it } from "vitest";
import { ValidationError, validateStep, validateSubmission } from "@/lib/onboarding/validate";
import { validDraft } from "./fixtures/onboarding-draft";

describe("validateSubmission", () => {
  it("accepts a complete baseline submission", () => {
    const result = validateSubmission(validDraft());
    expect(result.full_name).toBe("Marisol Keene");
    expect(result.accuracy_acknowledgement).toBe(true);
  });

  it("rejects missing required values", () => {
    expect(() => validateSubmission(validDraft({ full_name: "", email: "" }))).toThrow(ValidationError);
  });

  it("rejects unknown fields", () => {
    expect(() => validateSubmission({ ...validDraft(), extra_field: "nope" })).toThrow(ValidationError);
  });

  it("rejects invalid enums", () => {
    expect(() => validateSubmission(validDraft({ sex: "unknown-sex" as never }))).toThrow(ValidationError);
  });

  it("requires health acknowledgement", () => {
    try {
      validateSubmission(validDraft({ health_acknowledgement: false }));
      throw new Error("expected ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fields.health_acknowledgement).toBeTruthy();
    }
  });

  it("requires accuracy acknowledgement", () => {
    try {
      validateSubmission(validDraft({ accuracy_acknowledgement: false }));
      throw new Error("expected ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fields.accuracy_acknowledgement).toBeTruthy();
    }
  });

  it("validates height in cm", () => {
    expect(() => validateSubmission(validDraft({ height_unit: "cm", height_value: "90" }))).toThrow(
      ValidationError,
    );
    expect(validateSubmission(validDraft({ height_unit: "cm", height_value: "165" })).height_value).toBe("165");
  });

  it("validates height in ft/in", () => {
    expect(() =>
      validateSubmission(validDraft({ height_unit: "ft_in", height_value: "5", height_inches: "20" })),
    ).toThrow(ValidationError);
    const result = validateSubmission(
      validDraft({ height_unit: "ft_in", height_value: "5", height_inches: "7" }),
    );
    expect(result.height_unit).toBe("ft_in");
  });

  it("validates weight in lb and kg", () => {
    expect(() => validateSubmission(validDraft({ weight_unit: "lb", weight_value: "40" }))).toThrow(
      ValidationError,
    );
    expect(validateSubmission(validDraft({ weight_unit: "lb", weight_value: "140" })).weight_unit).toBe("lb");
    expect(() => validateSubmission(validDraft({ weight_unit: "kg", weight_value: "10" }))).toThrow(
      ValidationError,
    );
    expect(validateSubmission(validDraft({ weight_unit: "kg", weight_value: "70" })).weight_unit).toBe("kg");
  });

  it("requires conditional health details", () => {
    expect(() => validateSubmission(validDraft({ current_injuries: "yes", current_injury_details: "" }))).toThrow(
      ValidationError,
    );
    const result = validateSubmission(
      validDraft({ current_injuries: "yes", current_injury_details: "Left knee" }),
    );
    expect(result.current_injury_details).toBe("Left knee");
  });

  it("validates multi-selects", () => {
    expect(() => validateSubmission(validDraft({ available_days: [] }))).toThrow(ValidationError);
    expect(() => validateSubmission(validDraft({ available_days: ["funday"] as never }))).toThrow(
      ValidationError,
    );
  });
});

describe("validateStep", () => {
  it("does not require fields on the welcome step", () => {
    expect(validateStep(0, validDraft({ full_name: "" }))).toEqual({});
  });

  it("validates the about-you step", () => {
    const errors = validateStep(1, validDraft({ email: "bad" }));
    expect(errors.email).toBeTruthy();
  });
});
