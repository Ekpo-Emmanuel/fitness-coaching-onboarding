export const SCHEMA_VERSION = "onboarding_v1";

export const SEX_OPTIONS = ["female", "male", "prefer_not_to_say"] as const;

export const HEIGHT_UNITS = ["cm", "ft_in"] as const;
export const WEIGHT_UNITS = ["lb", "kg"] as const;

export const ACTIVITY_LEVELS = [
  "mostly_sitting",
  "mix_sitting_walking",
  "mostly_standing",
  "physically_active",
  "very_physically_demanding",
] as const;

export const AVERAGE_STEPS = [
  "under_3000",
  "3000_5000",
  "5000_8000",
  "8000_10000",
  "10000_plus",
  "unknown",
] as const;

export const YES_NO = ["yes", "no"] as const;
export const YES_NO_UNSURE = ["yes", "no", "unsure"] as const;
export const YES_NO_PRIVATE = ["no", "yes", "prefer_privately"] as const;
export const PREGNANCY = ["no", "yes", "not_applicable", "prefer_privately"] as const;

export const TRAINING_EXPERIENCE = [
  "never",
  "under_3_months",
  "3_6_months",
  "6_12_months",
  "1_2_years",
  "2_plus_years",
] as const;

export const TRAINING_DAYS_AVAILABLE = ["2", "3", "4", "5", "6"] as const;

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const SESSION_DURATION = [
  "30_45",
  "45_60",
  "60_75",
  "75_90",
  "90_plus",
] as const;

export const TRAINING_LOCATION = [
  "commercial_gym",
  "apartment_gym",
  "home_gym",
  "home_limited_equipment",
  "other",
] as const;

export const EQUIPMENT = [
  "barbells",
  "dumbbells",
  "squat_rack",
  "smith_machine",
  "cable_machines",
  "leg_press",
  "hack_squat",
  "selectorized_machines",
  "cardio_equipment",
  "resistance_bands",
  "other",
  "unsure",
] as const;

export const SECONDARY_GOALS = [
  "build_muscle",
  "build_strength",
  "lose_body_fat",
  "improve_muscle_definition",
  "grow_glutes",
  "grow_legs_quads",
  "improve_upper_body",
  "improve_conditioning",
  "improve_gym_confidence",
  "improve_general_health",
  "other",
] as const;

export const EATING_STRUCTURE = [
  "very_structured",
  "somewhat_structured",
  "inconsistent",
  "mostly_convenient",
  "unsure",
] as const;

export const DIETARY_RESTRICTIONS = [
  "none",
  "vegetarian",
  "vegan",
  "halal",
  "gluten_free",
  "dairy_free",
  "other",
] as const;

export const TAKEOUT_FREQUENCY = [
  "rarely",
  "1_2_week",
  "3_4_week",
  "5_plus_week",
] as const;

export const ALCOHOL_FREQUENCY = [
  "never",
  "occasionally",
  "weekly",
  "multiple_times_week",
] as const;

export const SLEEP_DURATION = [
  "under_5",
  "5_6",
  "6_7",
  "7_8",
  "8_plus",
] as const;

export const WORK_SCHEDULE = [
  "regular_daytime",
  "variable",
  "night_shifts",
  "rotating_shifts",
  "other",
] as const;

export const PROGRESS_METHODS = [
  "bodyweight",
  "progress_photos",
  "body_measurements",
  "strength",
  "workout_performance",
  "workout_completion",
  "daily_steps",
  "nutrition_consistency",
] as const;

export const FEEDBACK_PREFERENCE = [
  "direct",
  "encouraging",
  "detailed",
  "short_actionable",
  "combination",
] as const;

export const LABELS: Record<string, string> = {
  female: "Female",
  male: "Male",
  prefer_not_to_say: "Prefer not to say",
  cm: "cm",
  ft_in: "ft / in",
  lb: "lb",
  kg: "kg",
  mostly_sitting: "Mostly sitting",
  mix_sitting_walking: "Mix of sitting and walking",
  mostly_standing: "Mostly standing",
  physically_active: "Physically active",
  very_physically_demanding: "Very physically demanding",
  under_3000: "Under 3,000",
  "3000_5000": "3,000–5,000",
  "5000_8000": "5,000–8,000",
  "8000_10000": "8,000–10,000",
  "10000_plus": "10,000+",
  unknown: "I don't know",
  yes: "Yes",
  no: "No",
  unsure: "Unsure",
  prefer_privately: "Prefer to discuss privately",
  not_applicable: "Not applicable",
  never: "Never",
  under_3_months: "Less than 3 months",
  "3_6_months": "3–6 months",
  "6_12_months": "6–12 months",
  "1_2_years": "1–2 years",
  "2_plus_years": "2+ years",
  "30_45": "30–45 minutes",
  "45_60": "45–60 minutes",
  "60_75": "60–75 minutes",
  "75_90": "75–90 minutes",
  "90_plus": "90+ minutes",
  commercial_gym: "Commercial gym",
  apartment_gym: "Apartment gym",
  home_gym: "Home gym",
  home_limited_equipment: "Home with limited equipment",
  other: "Other",
  barbells: "Barbells",
  dumbbells: "Dumbbells",
  squat_rack: "Squat rack",
  smith_machine: "Smith machine",
  cable_machines: "Cable machines",
  leg_press: "Leg press",
  hack_squat: "Hack squat",
  selectorized_machines: "Selectorized machines",
  cardio_equipment: "Cardio equipment",
  resistance_bands: "Resistance bands",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
  build_muscle: "Build muscle",
  build_strength: "Build strength",
  lose_body_fat: "Lose body fat",
  improve_muscle_definition: "Improve muscle definition",
  grow_glutes: "Grow glutes",
  grow_legs_quads: "Grow legs / quads",
  improve_upper_body: "Improve upper-body development",
  improve_conditioning: "Improve conditioning",
  improve_gym_confidence: "Improve confidence in the gym",
  improve_general_health: "Improve general health",
  very_structured: "Very structured",
  somewhat_structured: "Somewhat structured",
  inconsistent: "Inconsistent",
  mostly_convenient: "Mostly whatever is convenient",
  none: "None",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  halal: "Halal",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  rarely: "Rarely",
  "1_2_week": "1–2 times / week",
  "3_4_week": "3–4 times / week",
  "5_plus_week": "5+ times / week",
  occasionally: "Occasionally",
  weekly: "Weekly",
  multiple_times_week: "Multiple times per week",
  under_5: "Under 5 hours",
  "5_6": "5–6 hours",
  "6_7": "6–7 hours",
  "7_8": "7–8 hours",
  "8_plus": "8+ hours",
  regular_daytime: "Regular daytime hours",
  variable: "Variable schedule",
  night_shifts: "Night shifts",
  rotating_shifts: "Rotating shifts",
  bodyweight: "Bodyweight",
  progress_photos: "Progress photos",
  body_measurements: "Body measurements",
  strength: "Strength",
  workout_performance: "Workout performance",
  workout_completion: "Workout completion",
  daily_steps: "Daily steps / activity",
  nutrition_consistency: "Nutrition consistency",
  direct: "Direct and straightforward",
  encouraging: "Encouraging and supportive",
  detailed: "Detailed explanations",
  short_actionable: "Short and actionable",
  combination: "A combination",
};

export function labelOf(value: string) {
  return LABELS[value] ?? value;
}
