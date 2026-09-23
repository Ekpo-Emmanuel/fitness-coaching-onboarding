import { describe, expect, it } from "vitest";
import { applyAgentOperations, parseAgentOperations } from "@/lib/agent/apply-operations";
import { createBlankOnboardingSchema } from "@/lib/forms/blank-schema";
import { defaultIdentityMapping } from "@/lib/forms/identity";

const mapping = {
  fullNameFieldKey: "full_name",
  emailFieldKey: "email",
  phoneFieldKey: null,
};

function base() {
  const schema = createBlankOnboardingSchema();
  return { schema, clientIdentityMapping: defaultIdentityMapping(schema) ?? mapping };
}

describe("agent operations", () => {
  it("updates metadata, intro, and success", () => {
    const start = base();
    const result = applyAgentOperations({
      ...start,
      operations: [
        { type: "update_form_metadata", title: "Muscle intake", estimatedMinutes: { min: 8, max: 12 } },
        { type: "update_intro", title: "Let's start", buttonLabel: "Begin" },
        { type: "update_success", title: "Received" },
      ],
    });
    expect(result.schema.title).toBe("Muscle intake");
    expect(result.schema.intro.title).toBe("Let's start");
    expect(result.schema.success.title).toBe("Received");
  });

  it("clips array descriptions without throwing", () => {
    const start = base();
    const result = applyAgentOperations({
      ...start,
      operations: [
        {
          type: "create_section",
          tempRef: "goals",
          title: "Goals",
          description: ["Line one", "Line two"] as unknown as string,
        },
      ],
    });
    expect(result.schema.sections.some((section) => section.title === "Goals")).toBe(true);
  });

  it("coerces string select options into unique values", () => {
    const start = base();
    const result = applyAgentOperations({
      ...start,
      operations: [
        {
          type: "create_field",
          sectionRef: "about",
          fieldType: "single_select",
          label: "Primary goal",
          options: ["Muscle gain", "Fat loss", "Both"] as unknown as { label: string; value: string }[],
        },
      ],
    });
    const field = result.schema.sections[0].fields.find((item) => item.label === "Primary goal");
    expect(field?.type).toBe("single_select");
    if (field?.type !== "single_select") throw new Error("expected select");
    expect(field.options.map((option) => option.value)).toEqual(["muscle_gain", "fat_loss", "both"]);
  });

  it("creates a required short-text occupation field on About", () => {
    const start = base();
    const result = applyAgentOperations({
      ...start,
      operations: [
        {
          type: "create_field",
          sectionRef: "about",
          fieldType: "short_text",
          label: "Current occupation",
          key: "current_occupation",
          required: true,
        },
      ],
    });
    const about = result.schema.sections.find((section) => section.key === "about");
    const field = about?.fields.find((item) => item.label === "Current occupation");
    expect(field?.type).toBe("short_text");
    expect(field?.required).toBe(true);
  });

  it("resolves existing section keys as sectionRef", () => {
    const start = base();
    const result = applyAgentOperations({
      ...start,
      operations: [
        {
          type: "create_field",
          sectionRef: "about",
          fieldType: "phone",
          label: "Phone",
          key: "phone",
        },
      ],
    });
    expect(result.schema.sections[0].fields.some((field) => field.key === "phone")).toBe(true);
  });

  it("creates, updates, moves, and deletes sections via temp refs", () => {
    const start = base();
    const created = applyAgentOperations({
      ...start,
      operations: [
        { type: "create_section", tempRef: "train", title: "Training" },
        { type: "update_section", sectionRef: "train", description: "How you train" },
        { type: "move_section", sectionRef: "train", toIndex: 0 },
      ],
    });
    expect(created.schema.sections.map((section) => section.title)).toContain("Training");
    expect(created.schema.sections[0].title).toBe("Training");
    const deleted = applyAgentOperations({
      schema: created.schema,
      clientIdentityMapping: created.clientIdentityMapping,
      operations: [{ type: "delete_section", sectionId: created.schema.sections[0].id }],
    });
    expect(deleted.schema.sections.some((section) => section.title === "Training")).toBe(false);
  });

  it("deletes the first matching section by title and remaps identity", () => {
    const start = base();
    const firstAbout = start.schema.sections[0];
    const keptAbout = {
      ...firstAbout,
      id: "sec_about_kept",
      key: "about_kept",
      fields: firstAbout.fields.map((field) => ({
        ...field,
        id: `${field.id}_kept`,
        key: field.key === "full_name" ? "full_name_kept" : field.key === "email" ? "email_kept" : field.key,
      })),
    };
    const firstFinal = start.schema.sections[1];
    const keptFinal = {
      ...firstFinal,
      id: "sec_final_kept",
      key: "final_kept",
      fields: firstFinal.fields.map((field) => ({ ...field, id: `${field.id}_kept`, key: `${field.key}_kept` })),
    };
    const schema = {
      ...start.schema,
      sections: [firstAbout, keptAbout, firstFinal, keptFinal],
    };
    const result = applyAgentOperations({
      schema,
      clientIdentityMapping: start.clientIdentityMapping,
      operations: [
        { type: "delete_section", sectionRef: "About you" },
        { type: "delete_section", sectionRef: "Final check" },
      ],
    });
    expect(result.schema.sections.map((section) => section.key)).toEqual(["about_kept", "final_kept"]);
    expect(result.clientIdentityMapping?.fullNameFieldKey).toBe("full_name_kept");
    expect(result.clientIdentityMapping?.emailFieldKey).toBe("email_kept");
  });

  it("creates, updates, moves, and deletes fields", () => {
    const start = base();
    const sectionId = start.schema.sections[0].id;
    const created = applyAgentOperations({
      ...start,
      operations: [
        {
          type: "create_field",
          tempRef: "goal",
          sectionId,
          fieldType: "single_select",
          label: "Primary goal",
          key: "primary_goal",
          required: true,
          options: [
            { label: "Muscle", value: "muscle" },
            { label: "Fat loss", value: "fat_loss" },
          ],
        },
        { type: "update_field", fieldRef: "goal", label: "What is your primary fitness goal?" },
        { type: "set_field_options", fieldRef: "goal", options: [{ label: "Muscle", value: "muscle" }] },
        { type: "set_field_validation", fieldRef: "goal", validation: { requiredMessage: "Choose one." } },
        {
          type: "set_field_logic",
          fieldRef: "goal",
          logic: { action: "show", all: [{ fieldKey: "full_name", operator: "is_not_empty" }] },
        },
        { type: "move_field", fieldRef: "goal", toIndex: 0 },
      ],
    });
    expect(created.schema.sections[0].fields[0].label).toBe("What is your primary fitness goal?");
    const removed = applyAgentOperations({
      schema: created.schema,
      clientIdentityMapping: created.clientIdentityMapping,
      operations: [{ type: "delete_field", fieldId: created.schema.sections[0].fields[0].id }],
    });
    expect(removed.schema.sections[0].fields.some((field) => field.key === "primary_goal")).toBe(false);
  });

  it("updates identity mapping", () => {
    const start = base();
    const result = applyAgentOperations({
      ...start,
      operations: [{ type: "set_client_identity_mapping", mapping: { fullNameFieldKey: "full_name", emailFieldKey: "email" } }],
    });
    expect(result.clientIdentityMapping?.emailFieldKey).toBe("email");
  });

  it("rejects unknown targets, duplicate keys, and bad logic", () => {
    const start = base();
    expect(() =>
      applyAgentOperations({
        ...start,
        operations: [{ type: "delete_field", fieldId: "missing" }],
      }),
    ).toThrow(/not found/i);
    const collided = applyAgentOperations({
      ...start,
      operations: [
        {
          type: "create_field",
          sectionId: start.schema.sections[0].id,
          fieldType: "short_text",
          label: "Name copy",
          key: "full_name",
        },
      ],
    });
    expect(collided.schema.sections[0].fields.some((field) => field.key === "full_name_2")).toBe(true);
    expect(() =>
      applyAgentOperations({
        ...start,
        operations: [
          {
            type: "set_field_logic",
            fieldId: start.schema.sections[0].fields[0].id,
            logic: { action: "show", all: [{ fieldKey: "nope", operator: "equals", value: "x" }] },
          },
        ],
      }),
    ).toThrow(/missing question/i);
  });

  it("rejects replace-style unknown operations", () => {
    expect(() => parseAgentOperations([{ type: "replace_entire_schema" }])).toThrow(/Unsupported/);
  });

  it("coerces stringified operations and op aliases", () => {
    const parsed = parseAgentOperations(
      JSON.stringify([{ op: "create_section", tempRef: "goals", title: "Goals" }]),
    );
    expect(parsed[0]).toMatchObject({ type: "create_section", tempRef: "goals" });
  });

  it("expands nested section fields into create operations", () => {
    const parsed = parseAgentOperations({
      sections: [
        {
          title: "Goals",
          questions: [{ label: "Main goal", type: "single_select" }],
        },
      ],
    });
    expect(parsed).toEqual([
      expect.objectContaining({ type: "create_section", title: "Goals", tempRef: "goals" }),
      expect.objectContaining({
        type: "create_field",
        label: "Main goal",
        fieldType: "single_select",
        sectionRef: "goals",
      }),
    ]);
  });

  it("creates and deletes review rules with field validation", () => {
    const start = base();
    const created = applyAgentOperations({
      ...start,
      operations: [
        {
          type: "create_review_rule",
          tempRef: "pain",
          label: "Current pain reported",
          conditions: { all: [{ fieldKey: "full_name", operator: "is_not_empty" }] },
          sourceFieldKeys: ["full_name"],
        },
      ],
    });
    expect(created.reviewRules?.rules).toHaveLength(1);
    expect(created.reviewRules?.rules[0].label).toBe("Current pain reported");
    const inferred = applyAgentOperations({
      ...start,
      operations: [
        {
          type: "create_field",
          sectionRef: "about",
          fieldType: "boolean",
          label: "Are you currently dealing with any pain or injury?",
          key: "current_pain",
        },
        {
          type: "create_field",
          sectionRef: "about",
          fieldType: "boolean",
          label: "Has a clinician told you to avoid or modify exercises?",
          key: "exercise_restrictions",
        },
        // @ts-expect-error Intentionally incomplete provider output exercises normalization.
        {
          type: "create_review_rule",
          label: "Current pain reported",
        },
        // @ts-expect-error Intentionally incomplete provider output exercises normalization.
        {
          type: "create_review_rule",
          label: "Exercise restrictions reported",
        },
      ],
    });
    expect(inferred.reviewRules?.rules).toHaveLength(2);
    expect(inferred.reviewRules?.rules[0].conditions.all?.[0]).toMatchObject({
      fieldKey: "current_pain",
      operator: "equals",
      value: true,
    });
    expect(inferred.reviewRules?.rules[1].sourceFieldKeys).toEqual(["exercise_restrictions"]);
    expect(() =>
      applyAgentOperations({
        ...start,
        operations: [
          {
            type: "create_review_rule",
            label: "Current pain reported",
            conditions: { all: [{ fieldKey: "missing", operator: "equals", value: "yes" }] },
            sourceFieldKeys: ["missing"],
          },
        ],
      }),
    ).toThrow(/missing/i);
    const deleted = applyAgentOperations({
      schema: created.schema,
      clientIdentityMapping: created.clientIdentityMapping,
      reviewRules: created.reviewRules,
      operations: [{ type: "delete_review_rule", ruleId: created.reviewRules!.rules[0].id }],
    });
    expect(deleted.reviewRules?.rules).toHaveLength(0);
  });
});
