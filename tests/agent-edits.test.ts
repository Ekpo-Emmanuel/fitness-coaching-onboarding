import { describe, expect, it } from "vitest";
import { applyAgentOperations, parseAgentOperations } from "@/lib/agent/apply-operations";
import { createBlankOnboardingSchema } from "@/lib/forms/blank-schema";
import { addField, addSection } from "@/lib/forms/schema-ops";
import { defaultIdentityMapping } from "@/lib/forms/identity";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";

function coachingForm() {
  let schema: OnboardingSchema = createBlankOnboardingSchema();
  const aboutId = schema.sections[0].id;
  schema = addField(schema, aboutId, "phone", "Phone / WhatsApp");
  schema = {
    ...schema,
    sections: schema.sections.map((section, index) =>
      index === 0
        ? {
            ...section,
            fields: section.fields.map((field) =>
              field.label === "Phone / WhatsApp" ? { ...field, required: true } : field,
            ),
          }
        : section,
    ),
  };
  schema = addField(schema, aboutId, "date", "Date of birth");
  schema = addField(schema, aboutId, "single_select", "Sex");
  schema = addField(schema, aboutId, "short_text", "Emergency contact");
  schema = addSection(schema, "Training");
  schema = addSection(schema, "Nutrition");
  schema = addSection(schema, "Lifestyle");
  const training = schema.sections.find((section) => section.title === "Training")!;
  const nutrition = schema.sections.find((section) => section.title === "Nutrition")!;
  const lifestyle = schema.sections.find((section) => section.title === "Lifestyle")!;
  schema = addField(schema, training.id, "short_text", "Training experience");
  schema = addField(schema, nutrition.id, "long_text", "Typical meals");
  schema = addField(schema, nutrition.id, "short_text", "Food allergies");
  schema = addField(schema, nutrition.id, "short_text", "Supplements");
  schema = addField(schema, nutrition.id, "short_text", "Water intake");
  schema = addField(schema, nutrition.id, "short_text", "Hunger patterns");
  schema = addField(schema, lifestyle.id, "boolean", "Any current injury?");
  schema = addField(schema, lifestyle.id, "short_text", "Medical conditions");
  return { schema, clientIdentityMapping: defaultIdentityMapping(schema) };
}

function labels(schema: OnboardingSchema, title: string) {
  return schema.sections.find((section) => section.title === title)?.fields.map((field) => field.label) ?? [];
}

describe("agent natural-language edit operations", () => {
  it("replaces Date of birth with Age in the same position", () => {
    const start = coachingForm();
    const before = labels(start.schema, "About you");
    const dobIndex = before.indexOf("Date of birth");
    const result = applyAgentOperations({
      ...start,
      operations: [
        {
          type: "create_field",
          sectionRef: "about",
          replaceFieldRef: "date_of_birth",
          fieldType: "number",
          label: "Age",
          required: true,
        },
      ],
    });
    const after = labels(result.schema, "About you");
    expect(after[dobIndex]).toBe("Age");
    expect(after).not.toContain("Date of birth");
    expect(after.filter((label) => label === "Age")).toHaveLength(1);
    expect(after).not.toContain("Question");
    expect(after.filter((label) => label !== "Age")).toEqual(before.filter((label) => label !== "Date of birth"));
    expect(result.changeSummary.details[0]).toMatch(/Replaced: Date of birth → Age/);
  });

  it("resolves replace_field aliases and label-based fieldRef", () => {
    const parsed = parseAgentOperations([
      {
        type: "replace_field",
        sectionRef: "About you",
        fieldRef: "Date of birth",
        fieldType: "number",
        label: "Age",
      },
    ]);
    expect(parsed[0]).toMatchObject({
      type: "create_field",
      replaceFieldRef: "Date of birth",
      label: "Age",
    });
    const start = coachingForm();
    const result = applyAgentOperations({ ...start, operations: parsed });
    expect(labels(result.schema, "About you")).toContain("Age");
    expect(labels(result.schema, "About you")).not.toContain("Date of birth");
  });

  it("coerces required strings on update_field", () => {
    const parsed = parseAgentOperations([
      { type: "update_field", fieldRef: "phone", required: "optional" },
    ]);
    expect(parsed[0]).toMatchObject({ type: "update_field", required: false });
  });

  it("does not turn update_field into create_field", () => {
    const parsed = parseAgentOperations([
      { type: "update_field", fieldRef: "full_name", label: "Your full name" },
    ]);
    expect(parsed).toEqual([expect.objectContaining({ type: "update_field", fieldRef: "full_name" })]);
  });

  it("rejects placeholder question labels", () => {
    expect(() =>
      parseAgentOperations([{ type: "create_field", sectionRef: "about", fieldType: "short_text" }]),
    ).toThrow(/real label/i);
    expect(() =>
      applyAgentOperations({
        ...coachingForm(),
        operations: [{ type: "create_field", sectionRef: "about", fieldType: "short_text", label: "Question" }],
      }),
    ).toThrow(/real label/i);
  });

  it("makes Phone / WhatsApp optional without duplicating it", () => {
    const start = coachingForm();
    const count = labels(start.schema, "About you").filter((label) => label === "Phone / WhatsApp").length;
    const result = applyAgentOperations({
      ...start,
      operations: [{ type: "update_field", fieldRef: "the phone question", required: false }],
    });
    const phone = result.schema.sections[0].fields.find((field) => field.label === "Phone / WhatsApp");
    expect(phone?.required).toBe(false);
    expect(labels(result.schema, "About you").filter((label) => label === "Phone / WhatsApp")).toHaveLength(count);
  });

  it("renames Full name in place", () => {
    const start = coachingForm();
    const result = applyAgentOperations({
      ...start,
      operations: [{ type: "update_field", fieldRef: "Full name", label: "Your full name" }],
    });
    expect(labels(result.schema, "About you")[0]).toBe("Your full name");
    expect(result.schema.sections[0].fields.filter((field) => field.key === "full_name")).toHaveLength(1);
  });

  it("removes the Sex question", () => {
    const start = coachingForm();
    const result = applyAgentOperations({
      ...start,
      operations: [{ type: "delete_field", fieldRef: "the Sex question" }],
    });
    expect(labels(result.schema, "About you")).not.toContain("Sex");
    expect(labels(result.schema, "About you")).toContain("Full name");
  });

  it("adds Occupation after Email", () => {
    const start = coachingForm();
    const result = applyAgentOperations({
      ...start,
      operations: [
        {
          type: "create_field",
          sectionRef: "about",
          afterFieldRef: "email",
          fieldType: "short_text",
          label: "Occupation",
        },
      ],
    });
    const after = labels(result.schema, "About you");
    expect(after[after.indexOf("Email") + 1]).toBe("Occupation");
  });

  it("moves Nutrition before Training", () => {
    const start = coachingForm();
    const nutritionIndex = start.schema.sections.findIndex((section) => section.title === "Training");
    const result = applyAgentOperations({
      ...start,
      operations: [{ type: "move_section", sectionRef: "Nutrition", toIndex: nutritionIndex }],
    });
    const titles = result.schema.sections.map((section) => section.title);
    expect(titles.indexOf("Nutrition")).toBeLessThan(titles.indexOf("Training"));
    expect(titles.filter((title) => title === "Nutrition")).toHaveLength(1);
  });

  it("adds a sleep question to Lifestyle", () => {
    const start = coachingForm();
    const result = applyAgentOperations({
      ...start,
      operations: [
        {
          type: "create_field",
          sectionRef: "lifestyle",
          fieldType: "short_text",
          label: "How is your sleep?",
        },
      ],
    });
    expect(labels(result.schema, "Lifestyle").at(-1)).toBe("How is your sleep?");
  });

  it("moves the injury question below medical conditions", () => {
    const start = coachingForm();
    const lifestyle = start.schema.sections.find((section) => section.title === "Lifestyle")!;
    const medicalIndex = lifestyle.fields.findIndex((field) => field.label === "Medical conditions");
    const result = applyAgentOperations({
      ...start,
      operations: [{ type: "move_field", fieldRef: "Any current injury?", toIndex: medicalIndex }],
    });
    expect(labels(result.schema, "Lifestyle")).toEqual(["Medical conditions", "Any current injury?"]);
  });

  it("refuses ambiguous field references instead of guessing", () => {
    const start = coachingForm();
    const aboutId = start.schema.sections[0].id;
    let schema = addField(start.schema, aboutId, "short_text", "Goal");
    schema = addField(schema, aboutId, "short_text", "Goal");
    expect(() =>
      applyAgentOperations({
        schema,
        clientIdentityMapping: start.clientIdentityMapping,
        operations: [{ type: "delete_field", fieldRef: "Goal" }],
      }),
    ).toThrow(/Ambiguous question reference/i);
  });

  it("treats consecutive delete + create in the same section as a positional replace", () => {
    const start = coachingForm();
    const dobIndex = labels(start.schema, "About you").indexOf("Date of birth");
    const result = applyAgentOperations({
      ...start,
      operations: [
        { type: "delete_field", fieldRef: "date_of_birth" },
        { type: "create_field", sectionRef: "about", fieldType: "number", label: "Age" },
      ],
    });
    expect(labels(result.schema, "About you")[dobIndex]).toBe("Age");
    expect(result.changeSummary.details).toEqual(["Replaced: Date of birth → Age"]);
  });

  it("shortens Nutrition by removing extra questions", () => {
    const start = coachingForm();
    const result = applyAgentOperations({
      ...start,
      operations: [
        { type: "delete_field", fieldRef: "water_intake" },
        { type: "delete_field", fieldRef: "hunger_patterns" },
        { type: "delete_field", fieldRef: "supplements" },
      ],
    });
    expect(labels(result.schema, "Nutrition")).toEqual(["Typical meals", "Food allergies"]);
    expect(result.schema.sections.map((section) => section.title)).toContain("Nutrition");
  });
});
