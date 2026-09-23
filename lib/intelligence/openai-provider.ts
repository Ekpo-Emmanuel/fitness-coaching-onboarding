import OpenAI from "openai";
import { jsonObjectInput } from "@/lib/ai/json-mode";
import { assertOpenAIConfigured, getCoachBriefModel } from "@/lib/ai/config";
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

export class OpenAISubmissionIntelligenceProvider implements SubmissionIntelligenceProvider {
  constructor(private schema: OnboardingSchema) {}

  async generateCoachBrief(input: CoachBriefInput): Promise<CoachBriefPayload> {
    const { apiKey } = assertOpenAIConfigured();
    const model = getCoachBriefModel();
    const client = new OpenAI({ apiKey, timeout: 45_000, maxRetries: 0 });
    let lastError: unknown;
    for (let attempt = 0; attempt <= BRIEF_LIMITS.maxAutoRetries; attempt += 1) {
      try {
        const response = await client.responses.create({
          model,
          instructions: SYSTEM_PROMPT,
          input: jsonObjectInput(input),
          text: { format: { type: "json_object" } },
        });
        const text = response.output_text;
        if (!text) throw new IntelligenceProviderError("malformed");
        return parseCoachBriefPayload(JSON.parse(text) as unknown, this.schema);
      } catch (error) {
        lastError = error;
        if (error instanceof IntelligenceProviderError && error.code === "malformed" && attempt < BRIEF_LIMITS.maxAutoRetries) {
          continue;
        }
        throw mapError(error);
      }
    }
    throw mapError(lastError);
  }
}

function mapError(error: unknown): IntelligenceProviderError {
  if (error instanceof IntelligenceProviderError) return error;
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0;
  if (status === 401 || status === 403) return new IntelligenceProviderError("invalid_key");
  if (status === 429) return new IntelligenceProviderError("rate_limit");
  const name = error instanceof Error ? error.name : "";
  if (name === "APIConnectionTimeoutError" || name === "TimeoutError") return new IntelligenceProviderError("timeout");
  if (error instanceof SyntaxError) return new IntelligenceProviderError("malformed");
  return new IntelligenceProviderError("unavailable");
}

export function createSubmissionIntelligenceProvider(schema: OnboardingSchema): SubmissionIntelligenceProvider {
  return new OpenAISubmissionIntelligenceProvider(schema);
}
