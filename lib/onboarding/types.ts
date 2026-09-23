import type {
  ACTIVITY_LEVELS,
  ALCOHOL_FREQUENCY,
  AVERAGE_STEPS,
  DIETARY_RESTRICTIONS,
  EATING_STRUCTURE,
  EQUIPMENT,
  FEEDBACK_PREFERENCE,
  HEIGHT_UNITS,
  PREGNANCY,
  PROGRESS_METHODS,
  SECONDARY_GOALS,
  SESSION_DURATION,
  SEX_OPTIONS,
  SLEEP_DURATION,
  TAKEOUT_FREQUENCY,
  TRAINING_DAYS_AVAILABLE,
  TRAINING_EXPERIENCE,
  TRAINING_LOCATION,
  WEEKDAYS,
  WEIGHT_UNITS,
  WORK_SCHEDULE,
  YES_NO,
  YES_NO_PRIVATE,
  YES_NO_UNSURE,
} from "./constants";

type ValueOf<T extends readonly string[]> = T[number];

export type OnboardingDraft = {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  sex: ValueOf<typeof SEX_OPTIONS> | "";
  height_value: string;
  height_unit: ValueOf<typeof HEIGHT_UNITS>;
  height_inches: string;
  weight_value: string;
  weight_unit: ValueOf<typeof WEIGHT_UNITS>;
  occupation: string;
  activity_level: ValueOf<typeof ACTIVITY_LEVELS> | "";
  average_steps: ValueOf<typeof AVERAGE_STEPS> | "";
  current_injuries: ValueOf<typeof YES_NO> | "";
  current_injury_details: string;
  previous_injuries: ValueOf<typeof YES_NO> | "";
  previous_injury_details: string;
  surgeries: ValueOf<typeof YES_NO> | "";
  surgery_details: string;
  exercise_restrictions: ValueOf<typeof YES_NO> | "";
  exercise_restriction_details: string;
  medical_conditions: ValueOf<typeof YES_NO_UNSURE> | "";
  medical_condition_details: string;
  medications: ValueOf<typeof YES_NO_PRIVATE> | "";
  medication_details: string;
  pregnancy_considerations: ValueOf<typeof PREGNANCY> | "";
  health_additional_notes: string;
  health_acknowledgement: boolean;
  training_experience: ValueOf<typeof TRAINING_EXPERIENCE> | "";
  current_training_days: string;
  current_training_description: string;
  structured_program_experience: ValueOf<typeof YES_NO> | "";
  confident_exercises: string;
  uncertain_exercises: string;
  disliked_exercises: string;
  preferred_exercises: string;
  training_days_available: ValueOf<typeof TRAINING_DAYS_AVAILABLE> | "";
  available_days: Array<ValueOf<typeof WEEKDAYS>>;
  session_duration: ValueOf<typeof SESSION_DURATION> | "";
  training_location: ValueOf<typeof TRAINING_LOCATION> | "";
  gym_name: string;
  equipment_access: Array<ValueOf<typeof EQUIPMENT>>;
  in_person_location_preference: string;
  primary_goal: string;
  secondary_goals: Array<ValueOf<typeof SECONDARY_GOALS>>;
  goal_changes: ValueOf<typeof YES_NO> | "";
  goal_change_details: string;
  current_eating: ValueOf<typeof EATING_STRUCTURE> | "";
  meals_per_day: string;
  typical_breakfast: string;
  typical_lunch: string;
  typical_dinner: string;
  typical_snacks: string;
  typical_drinks: string;
  calorie_tracking: ValueOf<typeof YES_NO> | "";
  current_calories: string;
  current_protein: string;
  current_carbs: string;
  current_fat: string;
  food_allergies: ValueOf<typeof YES_NO> | "";
  food_allergy_details: string;
  dietary_restrictions: Array<ValueOf<typeof DIETARY_RESTRICTIONS>>;
  dietary_restriction_details: string;
  preferred_foods: string;
  disliked_foods: string;
  takeout_frequency: ValueOf<typeof TAKEOUT_FREQUENCY> | "";
  water_intake: string;
  alcohol_frequency: ValueOf<typeof ALCOHOL_FREQUENCY> | "";
  weight_change_history: ValueOf<typeof YES_NO> | "";
  weight_change_details: string;
  sleep_duration: ValueOf<typeof SLEEP_DURATION> | "";
  sleep_quality: number | null;
  stress_level: number | null;
  stress_sources: string;
  work_schedule: ValueOf<typeof WORK_SCHEDULE> | "";
  work_schedule_details: string;
  schedule_challenges: string;
  progress_methods: Array<ValueOf<typeof PROGRESS_METHODS>>;
  progress_photos: ValueOf<typeof YES_NO> | "";
  feedback_preference: Array<ValueOf<typeof FEEDBACK_PREFERENCE>>;
  consistency_challenges: string;
  fall_off_causes: string;
  coaching_dislikes: string;
  coaching_concerns: string;
  additional_notes: string;
  accuracy_acknowledgement: boolean;
};

export type ValidatedOnboarding = Omit<
  OnboardingDraft,
  | "sex"
  | "activity_level"
  | "average_steps"
  | "current_injuries"
  | "previous_injuries"
  | "surgeries"
  | "exercise_restrictions"
  | "medical_conditions"
  | "medications"
  | "pregnancy_considerations"
  | "training_experience"
  | "structured_program_experience"
  | "training_days_available"
  | "session_duration"
  | "training_location"
  | "goal_changes"
  | "current_eating"
  | "calorie_tracking"
  | "food_allergies"
  | "takeout_frequency"
  | "alcohol_frequency"
  | "weight_change_history"
  | "sleep_duration"
  | "sleep_quality"
  | "stress_level"
  | "work_schedule"
  | "progress_photos"
> & {
  sex: ValueOf<typeof SEX_OPTIONS>;
  activity_level: ValueOf<typeof ACTIVITY_LEVELS>;
  average_steps: ValueOf<typeof AVERAGE_STEPS>;
  current_injuries: ValueOf<typeof YES_NO>;
  previous_injuries: ValueOf<typeof YES_NO>;
  surgeries: ValueOf<typeof YES_NO>;
  exercise_restrictions: ValueOf<typeof YES_NO>;
  medical_conditions: ValueOf<typeof YES_NO_UNSURE>;
  medications: ValueOf<typeof YES_NO_PRIVATE>;
  pregnancy_considerations: ValueOf<typeof PREGNANCY>;
  training_experience: ValueOf<typeof TRAINING_EXPERIENCE>;
  structured_program_experience: ValueOf<typeof YES_NO>;
  training_days_available: ValueOf<typeof TRAINING_DAYS_AVAILABLE>;
  session_duration: ValueOf<typeof SESSION_DURATION>;
  training_location: ValueOf<typeof TRAINING_LOCATION>;
  goal_changes: ValueOf<typeof YES_NO>;
  current_eating: ValueOf<typeof EATING_STRUCTURE>;
  calorie_tracking: ValueOf<typeof YES_NO>;
  food_allergies: ValueOf<typeof YES_NO>;
  takeout_frequency: ValueOf<typeof TAKEOUT_FREQUENCY>;
  alcohol_frequency: ValueOf<typeof ALCOHOL_FREQUENCY>;
  weight_change_history: ValueOf<typeof YES_NO>;
  sleep_duration: ValueOf<typeof SLEEP_DURATION>;
  sleep_quality: number;
  stress_level: number;
  work_schedule: ValueOf<typeof WORK_SCHEDULE>;
  progress_photos: ValueOf<typeof YES_NO>;
};

export type StoredOnboarding = ValidatedOnboarding & {
  submission_id: string;
  submitted_at: string;
  schema_version: string;
  coach_review_needed: boolean;
  health_flag: string;
  health_flag_reasons: string[];
  onboarding_status: string;
  coach_notes: string;
};

export const EMPTY_DRAFT: OnboardingDraft = {
  full_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  sex: "",
  height_value: "",
  height_unit: "cm",
  height_inches: "",
  weight_value: "",
  weight_unit: "lb",
  occupation: "",
  activity_level: "",
  average_steps: "",
  current_injuries: "",
  current_injury_details: "",
  previous_injuries: "",
  previous_injury_details: "",
  surgeries: "",
  surgery_details: "",
  exercise_restrictions: "",
  exercise_restriction_details: "",
  medical_conditions: "",
  medical_condition_details: "",
  medications: "",
  medication_details: "",
  pregnancy_considerations: "",
  health_additional_notes: "",
  health_acknowledgement: false,
  training_experience: "",
  current_training_days: "",
  current_training_description: "",
  structured_program_experience: "",
  confident_exercises: "",
  uncertain_exercises: "",
  disliked_exercises: "",
  preferred_exercises: "",
  training_days_available: "",
  available_days: [],
  session_duration: "",
  training_location: "",
  gym_name: "",
  equipment_access: [],
  in_person_location_preference: "",
  primary_goal: "",
  secondary_goals: [],
  goal_changes: "",
  goal_change_details: "",
  current_eating: "",
  meals_per_day: "",
  typical_breakfast: "",
  typical_lunch: "",
  typical_dinner: "",
  typical_snacks: "",
  typical_drinks: "",
  calorie_tracking: "",
  current_calories: "",
  current_protein: "",
  current_carbs: "",
  current_fat: "",
  food_allergies: "",
  food_allergy_details: "",
  dietary_restrictions: [],
  dietary_restriction_details: "",
  preferred_foods: "",
  disliked_foods: "",
  takeout_frequency: "",
  water_intake: "",
  alcohol_frequency: "",
  weight_change_history: "",
  weight_change_details: "",
  sleep_duration: "",
  sleep_quality: null,
  stress_level: null,
  stress_sources: "",
  work_schedule: "",
  work_schedule_details: "",
  schedule_challenges: "",
  progress_methods: [],
  progress_photos: "",
  feedback_preference: [],
  consistency_challenges: "",
  fall_off_causes: "",
  coaching_dislikes: "",
  coaching_concerns: "",
  additional_notes: "",
  accuracy_acknowledgement: false,
};
