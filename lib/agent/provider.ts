import type { ClientIdentityMapping } from "@/lib/forms/identity";
import type { ReviewRuleSet } from "@/lib/review/types";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
import type { CoachingProfile } from "@/lib/db/schema";
import { FIELD_TYPES } from "@/lib/forms/schema-ops";
import { AGENT_LIMITS } from "./limits";
import { AGENT_OPERATION_TYPES, type AgentOperation } from "./operations";
import { buildFormCatalog } from "./form-catalog";

export type FormAgentInput = {
  message: string;
  profile: Pick<
    CoachingProfile,
    | "businessName"
    | "coachName"
    | "coachingTypes"
    | "targetClientDescription"
    | "typicalGoals"
    | "typicalExperienceLevels"
    | "providesNutritionCoaching"
    | "requiresHealthScreening"
    | "coachingPhilosophy"
    | "programmingConsiderations"
  >;
  form: {
    id: string;
    name: string;
    status: string;
    revision: number;
    schema: OnboardingSchema;
    clientIdentityMapping: ClientIdentityMapping | null;
    reviewRules: ReviewRuleSet | null;
  };
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
};

export type FormAgentResult = {
  assistantMessage: string;
  operations: AgentOperation[];
};

export interface FormAgentProvider {
  proposeChanges(input: FormAgentInput): Promise<FormAgentResult>;
}

export function clipAgentPrompt(message: string) {
  return message.trim().slice(0, AGENT_LIMITS.maxPromptChars);
}

export function recentThreadMessages(messages: Array<{ role: "user" | "assistant"; content: string }>) {
  return messages.slice(-AGENT_LIMITS.maxContextMessages).map((item) => ({
    role: item.role,
    content: item.content.slice(0, AGENT_LIMITS.maxMessageChars),
  }));
}

export function buildAgentContext(input: FormAgentInput) {
  return {
    coachingProfile: {
      businessName: input.profile.businessName,
      coachName: input.profile.coachName,
      coachingTypes: input.profile.coachingTypes,
      targetClientDescription: input.profile.targetClientDescription,
      typicalGoals: input.profile.typicalGoals,
      typicalExperienceLevels: input.profile.typicalExperienceLevels,
      providesNutritionCoaching: input.profile.providesNutritionCoaching,
      requiresHealthScreening: input.profile.requiresHealthScreening,
      coachingPhilosophy: input.profile.coachingPhilosophy,
      programmingConsiderations: input.profile.programmingConsiderations,
    },
    form: {
      id: input.form.id,
      name: input.form.name,
      status: input.form.status,
      draftRevision: input.form.revision,
      clientIdentityMapping: input.form.clientIdentityMapping,
      reviewRules: input.form.reviewRules,
      schema: input.form.schema,
    },
    formCatalog: buildFormCatalog(input.form.schema, input.form.reviewRules),
    recentMessages: recentThreadMessages(input.recentMessages),
    coachRequest: clipAgentPrompt(input.message),
    operationTypes: AGENT_OPERATION_TYPES,
    fieldTypes: FIELD_TYPES,
  };
}
