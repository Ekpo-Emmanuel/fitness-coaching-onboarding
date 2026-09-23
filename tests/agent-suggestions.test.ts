import { describe, expect, it } from "vitest";
import { agentNextPrompts, agentStarterPrompts } from "@/app/forms/[formId]/build/agent-suggestions";
import { isDestructiveProposal, parseChangeDetails } from "@/app/forms/[formId]/build/agent-changes";
import SYSTEM_PROMPT from "@/lib/agent/system-prompt";
import { createBlankOnboardingSchema } from "@/lib/forms/blank-schema";
import { EMPTY_REVIEW_RULES } from "@/lib/review/types";

describe("agent starter prompts", () => {
  it("offers create-and-add prompts on a short form", () => {
    const prompts = agentStarterPrompts(createBlankOnboardingSchema());
    expect(prompts).toHaveLength(4);
    expect(prompts[0]).toMatch(/online coaching/i);
    expect(prompts.join(" ")).not.toMatch(/schema|optimize|field type/i);
  });

  it("suggests shortening a crowded section", () => {
    const schema = createBlankOnboardingSchema();
    schema.sections[0].fields.push(
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `fld_${index}`,
        key: `extra_${index}`,
        type: "short_text" as const,
        label: `Extra ${index}`,
        required: false,
        position: index + 2,
      })),
    );
    const prompts = agentStarterPrompts(schema, EMPTY_REVIEW_RULES);
    expect(prompts.some((item) => /shorter/i.test(item))).toBe(true);
    expect(prompts.some((item) => /review rules/i.test(item))).toBe(true);
  });

  it("offers next actions after a training change", () => {
    expect(agentNextPrompts(["Added section: Training"])[0]).toMatch(/frequency/i);
  });
});

describe("agent change details", () => {
  it("groups human labels without operation names", () => {
    const rows = parseChangeDetails(["Removed section: Nutrition", "Added question: Age"]);
    expect(rows[0]).toMatchObject({ kind: "remove", verb: "Remove section", label: "Nutrition", destructive: true });
    expect(rows[1]).toMatchObject({ kind: "add", verb: "Add", label: "Age" });
    expect(parseChangeDetails(["Replaced: Date of birth → Age"])[0]).toMatchObject({
      kind: "update",
      verb: "Replace",
      label: "Date of birth → Age",
    });
    expect(isDestructiveProposal(["Removed section: Nutrition"])).toBe(true);
  });
});

describe("agent system prompt", () => {
  it("asks for short coach-facing prose and forbids schema talk in assistantMessage", () => {
    expect(SYSTEM_PROMPT).toMatch(/one short sentence/i);
    expect(SYSTEM_PROMPT).toMatch(/replaceFieldRef/);
    expect(SYSTEM_PROMPT).toMatch(/Do not repeat the coach's request/);
  });
});
