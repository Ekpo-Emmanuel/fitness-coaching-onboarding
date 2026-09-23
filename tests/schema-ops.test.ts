import { describe, expect, it } from "vitest";
import { createBlankOnboardingSchema } from "@/lib/forms/blank-schema";
import {
  addField,
  addSection,
  deleteField,
  moveField,
  updateField,
  updateSection,
} from "@/lib/forms/schema-ops";
import { validateSchemaDefinition } from "@/lib/onboarding/schema/definition";
import { FormServiceError } from "@/lib/forms/errors";

describe("schema ops", () => {
  it("renames a section without changing its key", () => {
    const schema = createBlankOnboardingSchema();
    const about = schema.sections[0];
    const next = updateSection(schema, about.id, { title: "Your details" });
    expect(next.sections[0].key).toBe(about.key);
    expect(next.sections[0].title).toBe("Your details");
  });

  it("adds a field and keeps the key after a later label edit", () => {
    let schema = createBlankOnboardingSchema();
    schema = addField(schema, schema.sections[0].id, "short_text", "Preferred training time");
    const field = schema.sections[0].fields.at(-1)!;
    expect(field.key).toBe("preferred_training_time");
    const renamed = updateField(schema, field.id, { label: "When do you prefer to train?" });
    const after = renamed.sections[0].fields.find((item) => item.id === field.id)!;
    expect(after.key).toBe("preferred_training_time");
    expect(after.label).toBe("When do you prefer to train?");
  });

  it("adds select options and conditional logic", () => {
    let schema = createBlankOnboardingSchema();
    schema = addField(schema, schema.sections[0].id, "single_select", "Current injuries");
    const parent = schema.sections[0].fields.at(-1)!;
    schema = updateField(schema, parent.id, {
      options: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" },
      ],
    });
    schema = addField(schema, schema.sections[0].id, "long_text", "Injury details");
    const child = schema.sections[0].fields.at(-1)!;
    schema = updateField(schema, child.id, {
      logic: { action: "show", all: [{ fieldKey: parent.key, operator: "equals", value: "yes" }] },
    });
    expect(validateSchemaDefinition(schema)).toEqual([]);
    expect(schema.sections[0].fields.at(-1)?.logic?.all?.[0]?.fieldKey).toBe(parent.key);
  });

  it("reorders fields and normalizes position", () => {
    let schema = createBlankOnboardingSchema();
    const firstId = schema.sections[0].fields[0].id;
    schema = moveField(schema, firstId, 1);
    expect(schema.sections[0].fields.map((field) => field.position)).toEqual([0, 1]);
    expect(schema.sections[0].fields[1].id).toBe(firstId);
  });

  it("deletes a field", () => {
    let schema = createBlankOnboardingSchema();
    const fieldId = schema.sections[0].fields[0].id;
    schema = deleteField(schema, fieldId);
    expect(schema.sections[0].fields.some((field) => field.id === fieldId)).toBe(false);
  });

  it("rejects deleting a field still referenced by logic", () => {
    let schema = createBlankOnboardingSchema();
    schema = addField(schema, schema.sections[0].id, "single_select", "Flag");
    const parent = schema.sections[0].fields.at(-1)!;
    schema = addField(schema, schema.sections[0].id, "short_text", "Details");
    const child = schema.sections[0].fields.at(-1)!;
    schema = updateField(schema, child.id, {
      logic: { action: "show", all: [{ fieldKey: parent.key, operator: "equals", value: "yes" }] },
    });
    expect(() => deleteField(schema, parent.id)).toThrow(FormServiceError);
  });

  it("rejects unknown logic keys", () => {
    const schema = createBlankOnboardingSchema();
    const field = schema.sections[0].fields[0];
    expect(() =>
      updateField(schema, field.id, {
        logic: { action: "show", all: [{ fieldKey: "missing_field", operator: "equals", value: "yes" }] },
      }),
    ).toThrow();
  });

  it("adds a section", () => {
    const schema = addSection(createBlankOnboardingSchema(), "Training");
    expect(schema.sections).toHaveLength(3);
    expect(schema.sections[2].key).toBe("training");
  });
});
