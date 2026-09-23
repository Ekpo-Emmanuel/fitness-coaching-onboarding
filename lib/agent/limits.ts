export const AGENT_LIMITS = {
  maxPromptChars: 4_000,
  maxContextMessages: 12,
  maxMessageChars: 2_000,
  maxOperations: 80,
  maxCreateSections: 12,
  maxCreateFields: 40,
  maxOptions: 24,
  maxTextChars: 400,
  maxAutoRetries: 1,
} as const;
