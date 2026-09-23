import { loadEnvConfig } from "@next/env";
import { getDeepSeekConfig } from "../lib/ai/config";
import { applyAgentOperations } from "../lib/agent/apply-operations";
import { DeepSeekFormAgentProvider } from "../lib/agent/deepseek-provider";
import { createBlankOnboardingSchema } from "../lib/forms/blank-schema";
import { addField, addSection } from "../lib/forms/schema-ops";
import { defaultIdentityMapping } from "../lib/forms/identity";
import type { FormAgentInput } from "../lib/agent/provider";
import type { OnboardingSchema } from "../lib/onboarding/schema/types";

loadEnvConfig(process.cwd());

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
  schema = addField(schema, lifestyle.id, "boolean", "Any current injury?");
  schema = addField(schema, lifestyle.id, "short_text", "Medical conditions");
  return schema;
}

function labels(schema: OnboardingSchema, title: string) {
  return schema.sections.find((section) => section.title === title)?.fields.map((field) => field.label) ?? [];
}

function profile(): FormAgentInput["profile"] {
  return {
    businessName: "Northline Strength",
    coachName: "Mara Ellison",
    coachingTypes: ["online"],
    targetClientDescription: "Beginner men 20–35",
    typicalGoals: ["muscle"],
    typicalExperienceLevels: ["beginner"],
    providesNutritionCoaching: true,
    requiresHealthScreening: true,
    coachingPhilosophy: null,
    programmingConsiderations: null,
  };
}

async function run(schema: OnboardingSchema, message: string) {
  const provider = new DeepSeekFormAgentProvider();
  const result = await provider.proposeChanges({
    message,
    profile: profile(),
    form: {
      id: "fixture",
      name: "Intake",
      status: "draft",
      revision: 1,
      schema,
      clientIdentityMapping: defaultIdentityMapping(schema),
      reviewRules: null,
    },
    recentMessages: [],
  });
  const applied =
    result.operations.length === 0
      ? null
      : applyAgentOperations({
          schema,
          clientIdentityMapping: defaultIdentityMapping(schema),
          operations: result.operations,
        });
  return { result, applied };
}

async function main() {
  if (!process.env["DEEPSEEK_API_KEY"]) throw new Error("DEEPSEEK_API_KEY is required.");
  const schema = coachingForm();
  const dobIndex = labels(schema, "About you").indexOf("Date of birth");
  const replace = await run(schema, "Replace the date of birth in the about you section with age.");
  if (!replace.applied) throw new Error("Replace produced no operations.");
  const about = labels(replace.applied.schema, "About you");
  if (about[dobIndex] !== "Age") throw new Error(`Age not in Date of birth position. Got: ${about.join(" | ")}`);
  if (about.includes("Date of birth")) throw new Error("Date of birth still present.");
  if (about.includes("Question") || about.includes("Untitled")) throw new Error("Placeholder question created.");
  if (about.filter((label) => label === "Age").length !== 1) throw new Error("Duplicate Age.");
  console.log("replace_ok", JSON.stringify({ ops: replace.result.operations, details: replace.applied.changeSummary.details, about }));
  const optional = await run(schema, "Make Phone / WhatsApp optional.");
  console.log("optional_ops", JSON.stringify(optional.result.operations));
  const phone = optional.applied?.schema.sections[0].fields.find((field) => field.label === "Phone / WhatsApp");
  if (!phone || phone.required !== false) throw new Error("Phone was not made optional.");
  const rename = await run(schema, "Rename Full name to Your full name.");
  if (!rename.applied) throw new Error("Rename produced no operations.");
  if (labels(rename.applied.schema, "About you")[0] !== "Your full name") {
    throw new Error(`Rename failed. Got: ${labels(rename.applied.schema, "About you").join(" | ")}`);
  }
  const afterEmail = await run(schema, "Add Occupation after Email.");
  const afterEmailLabels = afterEmail.applied ? labels(afterEmail.applied.schema, "About you") : [];
  if (afterEmailLabels[afterEmailLabels.indexOf("Email") + 1] !== "Occupation") {
    throw new Error(`Insert after Email failed. Ops: ${JSON.stringify(afterEmail.result.operations)}`);
  }
  console.log(
    JSON.stringify(
      {
        DEEPSEEK_MODEL: getDeepSeekConfig().model,
        replaceOps: replace.result.operations,
        replaceMessage: replace.result.assistantMessage,
        replaceDetails: replace.applied.changeSummary.details,
        aboutAfterReplace: about,
        phoneOptional: phone.required === false,
        renameOps: rename.result.operations.map((operation) => operation.type),
        occupationAfterEmail: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
