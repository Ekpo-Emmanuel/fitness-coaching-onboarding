import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
import { BLANK_SCHEMA_VERSION } from "./constants";
import { newEntityId } from "./keys";

export function createBlankOnboardingSchema(title = "Client onboarding"): OnboardingSchema {
  const schemaId = newEntityId("sch");
  const aboutId = newEntityId("sec");
  const finalId = newEntityId("sec");
  const nameId = newEntityId("fld");
  const emailId = newEntityId("fld");
  const ackId = newEntityId("fld");
  return {
    id: schemaId,
    schemaVersion: BLANK_SCHEMA_VERSION,
    title,
    estimatedMinutes: { min: 5, max: 10 },
    storageKey: `form_${schemaId}`,
    intro: {
      title: "Welcome",
      navLabel: "Welcome",
      description: ["A few questions so coaching can start from your actual routine, not a generic template."],
      buttonLabel: "Start",
    },
    sections: [
      {
        id: aboutId,
        key: "about",
        title: "About you",
        navLabel: "About",
        position: 0,
        fields: [
          {
            id: nameId,
            key: "full_name",
            type: "short_text",
            label: "Full name",
            required: true,
            position: 0,
            autoComplete: "name",
          },
          {
            id: emailId,
            key: "email",
            type: "email",
            label: "Email",
            required: true,
            position: 1,
            validation: { email: true },
          },
        ],
      },
      {
        id: finalId,
        key: "final",
        title: "Almost done.",
        navLabel: "Final check",
        position: 1,
        fields: [
          {
            id: ackId,
            key: "accuracy_acknowledgement",
            type: "acknowledgement",
            label: "Accuracy confirmation",
            statement: "I confirm that the information I've provided is accurate to the best of my knowledge.",
            required: true,
            position: 0,
          },
        ],
      },
    ],
    success: {
      title: "You're all set",
      message: ["I've received your answers and will use them to prepare your starting plan."],
      aside: "No more forms from here.",
    },
  };
}
