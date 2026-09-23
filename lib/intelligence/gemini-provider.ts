import { generateGeminiJson, mapGeminiError, parseModelJson } from "@/lib/ai/gemini";
import { getCoachBriefModel } from "@/lib/ai/config";
import { parseCoachBriefPayload } from "./payload";
import type { CoachBriefInput, CoachBriefPayload, SubmissionIntelligenceProvider } from "./types";
import { BRIEF_LIMITS, IntelligenceProviderError } from "./types";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";

const SYSTEM_PROMPT = `Organize submitted onboarding information into a concise coach-facing brief.

Refer to the person as "the client". Do not diagnose, speculate about diagnoses, determine medical severity, claim the client is safe to exercise, clear the client for exercise, prescribe medication or treatment, reject the client, or invent facts.

Stay close to submitted evidence. Do not recommend programs, splits, or calorie targets.

Return JSON only with this shape:
{
  "summary": { "text": string, "sourceFieldKeys": string[] },
  "goals": [{ "text": string, "sourceFieldKeys": string[] }],
  "training": [{ "text": string, "sourceFieldKeys": string[] }],
  "nutrition": [{ "text": string, "sourceFieldKeys": string[] }],
  "lifestyleRecovery": [{ "text": string, "sourceFieldKeys": string[] }],
  "coachingPreferences": [{ "text": string, "sourceFieldKeys": string[] }],
  "thingsToReview": [{ "text": string, "sourceFieldKeys": string[] }],
  "kickoffTopics": [{ "text": string, "sourceFieldKeys": string[] }]
}

summary is required. Omit empty arrays if a category has no supporting answers. Every item needs sourceFieldKeys that exist in the provided fields. Deterministic review flags are facts to highlight, not diagnoses.`;

export class GeminiSubmissionIntelligenceProvider implements SubmissionIntelligenceProvider {
  constructor(private schema: OnboardingSchema) {}

  async generateCoachBrief(input: CoachBriefInput): Promise<CoachBriefPayload> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= BRIEF_LIMITS.maxAutoRetries; attempt += 1) {
      try {
        const text = await generateGeminiJson(SYSTEM_PROMPT, JSON.stringify(input), getCoachBriefModel());
        return parseCoachBriefPayload(parseModelJson(text), this.schema);
      } catch (error) {
        lastError = error;
        if (error instanceof IntelligenceProviderError && error.code === "malformed" && attempt < BRIEF_LIMITS.maxAutoRetries) {
          continue;
        }
        throw mapIntelligenceError(error);
      }
    }
    throw mapIntelligenceError(lastError);
  }
}

function mapIntelligenceError(error: unknown): IntelligenceProviderError {
  if (error instanceof IntelligenceProviderError) return error;
  const mapped = mapGeminiError(error);
  return new IntelligenceProviderError(mapped.code);
}

export function createSubmissionIntelligenceProvider(schema: OnboardingSchema): SubmissionIntelligenceProvider {
  return new GeminiSubmissionIntelligenceProvider(schema);
}
