export type SourcedText = {
  text: string;
  sourceFieldKeys: string[];
};

export type CoachBriefPayload = {
  summary: SourcedText;
  goals?: SourcedText[];
  training?: SourcedText[];
  nutrition?: SourcedText[];
  lifestyleRecovery?: SourcedText[];
  coachingPreferences?: SourcedText[];
  thingsToReview?: SourcedText[];
  kickoffTopics?: SourcedText[];
};

export type CoachBriefFieldInput = {
  section: string;
  key: string;
  label: string;
  type: string;
  answer: string;
};

export type CoachBriefInput = {
  fields: CoachBriefFieldInput[];
  reviewFlags: Array<{ code: string; label: string; sourceFieldKeys: string[] }>;
  coaching: {
    providesNutritionCoaching: boolean;
    requiresHealthScreening: boolean;
    typicalGoals: string[];
    typicalExperienceLevels: string[];
  };
};

export interface SubmissionIntelligenceProvider {
  generateCoachBrief(input: CoachBriefInput): Promise<CoachBriefPayload>;
}

export class IntelligenceProviderError extends Error {
  constructor(
    public code: "missing_key" | "invalid_key" | "rate_limit" | "timeout" | "malformed" | "unavailable",
    message = "Coach Brief couldn't be generated.",
  ) {
    super(message);
    this.name = "IntelligenceProviderError";
  }
}

export const BRIEF_LIMITS = {
  maxAnswers: 40,
  maxAnswerChars: 400,
  maxTextChars: 800,
  maxItems: 8,
  maxSourceKeys: 20,
  maxAutoRetries: 1,
};
