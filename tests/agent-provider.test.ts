import { describe, expect, it } from "vitest";
import { AgentProviderError } from "@/lib/ai/config";
import { jsonObjectInput } from "@/lib/ai/json-mode";
import { parseModelJson } from "@/lib/ai/gemini";
import { parseAgentOperations } from "@/lib/agent/apply-operations";
import { AGENT_LIMITS } from "@/lib/agent/limits";
import { buildAgentContext, type FormAgentInput } from "@/lib/agent/provider";
import { createBlankOnboardingSchema } from "@/lib/forms/blank-schema";
import { defaultIdentityMapping } from "@/lib/forms/identity";

const schema = createBlankOnboardingSchema();

const input: FormAgentInput = {
  message: "Build my onboarding",
  profile: {
    businessName: "Northline Strength",
    coachName: "Mara Ellison",
    coachingTypes: ["online"],
    targetClientDescription: "Men 20–35 who struggle to build muscle",
    typicalGoals: ["muscle"],
    typicalExperienceLevels: ["beginner"],
    providesNutritionCoaching: false,
    requiresHealthScreening: true,
    coachingPhilosophy: "Simple progressive overload",
    programmingConsiderations: "Commercial gyms",
  },
  form: {
    id: "form-1",
    name: "Intake",
    status: "draft",
    revision: 3,
    schema,
    clientIdentityMapping: defaultIdentityMapping(schema),
    reviewRules: null,
  },
  recentMessages: [{ role: "user", content: "Hello" }],
};

describe("agent context and provider parsing", () => {
  it("includes form, draft revision, and coaching profile", () => {
    const context = buildAgentContext(input);
    expect(context.form.draftRevision).toBe(3);
    expect(context.form.name).toBe("Intake");
    expect(context.coachingProfile.businessName).toBe("Northline Strength");
    expect(context.coachingProfile.providesNutritionCoaching).toBe(false);
    expect(context.formCatalog.sections[0].ref).toBe("about");
    expect(context.formCatalog.sections[0].questions[0].ref).toBe("full_name");
    expect(context.operationTypes).toContain("delete_section");
    expect(context.operationTypes).toContain("delete_field");
    const packed = JSON.stringify(context);
    expect(packed).not.toContain("DATABASE_URL");
    expect(packed).not.toContain("GOOGLE_PRIVATE_KEY");
    expect(packed).not.toContain("BETTER_AUTH_SECRET");
    expect(packed).not.toContain("submission");
    expect(packed.toLowerCase()).not.toContain("sk-");
  });

  it("json mode input includes the word json", () => {
    expect(jsonObjectInput({ form: "Intake" }).toLowerCase()).toContain("json");
  });

  it("accepts message or assistantMessage as the coach-facing string", async () => {
    const { formAgentResultFromJson } = await import("@/lib/agent/deepseek-provider");
    expect(formAgentResultFromJson({ message: "Ready.", operations: [] }).assistantMessage).toBe("Ready.");
    expect(formAgentResultFromJson({ assistantMessage: "Ready.", operations: [] }).assistantMessage).toBe("Ready.");
  });

  it("strips markdown fences from model JSON", () => {
    expect(parseModelJson('```json\n{"assistantMessage":"Hi","operations":[]}\n```')).toEqual({
      assistantMessage: "Hi",
      operations: [],
    });
  });

  it("rejects excessive operations", () => {
    const ops = Array.from({ length: AGENT_LIMITS.maxOperations + 1 }, () => ({
      type: "update_intro",
      title: "Hi",
    }));
    expect(() => parseAgentOperations(ops)).toThrow(/too large/i);
  });

  it("maps provider failures without leaking internals", () => {
    const error = new AgentProviderError("rate_limit");
    expect(error.message).toContain("has not been changed");
    expect(error.message).not.toContain("openai");
  });
});
