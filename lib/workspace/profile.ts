export const COACHING_TYPE_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
  { value: "in_person", label: "In-person" },
  { value: "nutrition", label: "Nutrition" },
  { value: "other", label: "Other" },
] as const;

export const COACHING_TYPE_VALUES = COACHING_TYPE_OPTIONS.map((option) => option.value);

export type CoachingProfileInput = {
  businessName: string;
  coachName: string;
  coachingTypes: string[];
  targetClientDescription: string;
  providesNutritionCoaching: boolean;
  requiresHealthScreening: boolean;
  coachingPhilosophy: string;
  programmingConsiderations: string;
};

export function parseCoachingProfileInput(input: unknown): { data?: CoachingProfileInput; error?: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Submit a complete coaching profile." };
  }

  const body = input as Record<string, unknown>;
  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
  const coachName = typeof body.coachName === "string" ? body.coachName.trim() : "";
  const targetClientDescription =
    typeof body.targetClientDescription === "string" ? body.targetClientDescription.trim() : "";
  const coachingPhilosophy =
    typeof body.coachingPhilosophy === "string" ? body.coachingPhilosophy.trim() : "";
  const programmingConsiderations =
    typeof body.programmingConsiderations === "string" ? body.programmingConsiderations.trim() : "";

  if (!businessName) return { error: "Enter your business name." };
  if (!coachName) return { error: "Enter your name." };
  if (!targetClientDescription) return { error: "Describe who you primarily help." };

  if (!Array.isArray(body.coachingTypes) || body.coachingTypes.length === 0) {
    return { error: "Select at least one coaching type." };
  }

  const coachingTypes = body.coachingTypes.filter(
    (value): value is string => typeof value === "string" && COACHING_TYPE_VALUES.includes(value as (typeof COACHING_TYPE_VALUES)[number]),
  );
  if (coachingTypes.length === 0) {
    return { error: "Select at least one coaching type." };
  }

  if (typeof body.providesNutritionCoaching !== "boolean") {
    return { error: "Say whether you provide nutrition coaching." };
  }
  if (typeof body.requiresHealthScreening !== "boolean") {
    return { error: "Say whether you require health screening." };
  }

  return {
    data: {
      businessName,
      coachName,
      coachingTypes,
      targetClientDescription,
      providesNutritionCoaching: body.providesNutritionCoaching,
      requiresHealthScreening: body.requiresHealthScreening,
      coachingPhilosophy,
      programmingConsiderations,
    },
  };
}
