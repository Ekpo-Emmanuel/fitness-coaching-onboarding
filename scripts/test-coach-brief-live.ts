import { loadEnvConfig } from "@next/env";
import { createBlankOnboardingSchema } from "../lib/forms/blank-schema";
import { defaultIdentityMapping } from "../lib/forms/identity";
import { DeepSeekSubmissionIntelligenceProvider } from "../lib/intelligence/deepseek-provider";
import { buildCoachBriefInput } from "../lib/intelligence/payload";
import { emptyAnswers } from "../lib/onboarding/schema/engine";

loadEnvConfig(process.cwd());

/**
 * Optional live smoke. Uses DeepSeek. Uses a fixture schema, not production clients.
 * Usage: npm run test:coach-brief-live
 */
async function main() {
  if (!process.env["DEEPSEEK_API_KEY"]) {
    throw new Error("DEEPSEEK_API_KEY is required.");
  }
  const schema = createBlankOnboardingSchema();
  const answers = emptyAnswers(schema);
  answers.full_name = "Fixture Client";
  answers.email = "fixture@example.com";
  answers.accuracy_acknowledgement = true;
  const input = buildCoachBriefInput({
    schema,
    answers,
    mapping: defaultIdentityMapping(schema),
    reviewFlags: [],
    coaching: {
      providesNutritionCoaching: false,
      requiresHealthScreening: false,
      typicalGoals: ["muscle"],
      typicalExperienceLevels: ["beginner"],
    },
  });
  const provider = new DeepSeekSubmissionIntelligenceProvider(schema);
  const payload = await provider.generateCoachBrief(input);
  if (!payload.summary?.text) throw new Error("Live brief missing summary.");
  console.info("Coach brief live smoke passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
