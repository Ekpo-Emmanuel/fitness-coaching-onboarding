import { loadEnvConfig } from "@next/env";
import { getDeepSeekConfig } from "../lib/ai/config";
import { applyAgentOperations } from "../lib/agent/apply-operations";
import { DeepSeekFormAgentProvider } from "../lib/agent/deepseek-provider";
import { createBlankOnboardingSchema } from "../lib/forms/blank-schema";
import { defaultIdentityMapping } from "../lib/forms/identity";

loadEnvConfig(process.cwd());

/**
 * Optional live smoke. Uses DeepSeek. Does not publish or write clients.
 * Usage: npm run test:agent-live
 */
async function main() {
  if (!process.env["DEEPSEEK_API_KEY"]) {
    throw new Error("DEEPSEEK_API_KEY is required.");
  }
  const config = getDeepSeekConfig();
  const schema = createBlankOnboardingSchema();
  const mapping = defaultIdentityMapping(schema);
  const provider = new DeepSeekFormAgentProvider();
  const result = await provider.proposeChanges({
    message: "Add a required short-text field called Current occupation to the About section.",
    profile: {
      businessName: "Northline Strength",
      coachName: "Mara Ellison",
      coachingTypes: ["online"],
      targetClientDescription: "Beginner men 20–35",
      typicalGoals: ["muscle"],
      typicalExperienceLevels: ["beginner"],
      providesNutritionCoaching: false,
      requiresHealthScreening: true,
      coachingPhilosophy: null,
      programmingConsiderations: null,
    },
    form: {
      id: "fixture",
      name: "Intake",
      status: "draft",
      revision: 1,
      schema,
      clientIdentityMapping: mapping,
      reviewRules: null,
    },
    recentMessages: [],
  });

  const createField = result.operations.find((operation) => operation.type === "create_field");
  let applyStage: "ok" | "skipped" | "failed" = "skipped";
  let applyError: string | undefined;
  if (result.operations.length > 0) {
    try {
      const applied = applyAgentOperations({
        schema,
        clientIdentityMapping: mapping,
        operations: result.operations,
      });
      const about = applied.schema.sections.find((section) => section.key === "about");
      const field = about?.fields.find((item) => item.label === "Current occupation");
      applyStage = field?.type === "short_text" && field.required ? "ok" : "failed";
      applyError = applyStage === "failed" ? "applied ops but occupation field missing" : undefined;
    } catch (error) {
      applyStage = "failed";
      applyError = error instanceof Error ? error.message : String(error);
    }
  }

  console.log(
    JSON.stringify(
      {
        DEEPSEEK_MODEL: config.model,
        apiBaseUrl: config.baseURL,
        apiStyle: "openai_chat_completions",
        thinkingMode: "disabled",
        structuredOutputStrategy: "response_format.json_object",
        operations: result.operations.map((operation) => operation.type),
        createField,
        applyStage,
        applyError,
        preview: result.assistantMessage.slice(0, 240),
      },
      null,
      2,
    ),
  );
  if (applyStage !== "ok") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
