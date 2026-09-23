function envString(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getGeminiConfig() {
  const apiKey = envString("GEMINI_API_KEY");
  const model = envString("GEMINI_MODEL") || "gemini-3.8-flash";
  return { apiKey, model };
}

export function getOpenAIConfig() {
  const apiKey = envString("OPENAI_API_KEY");
  const model = envString("OPENAI_MODEL") || "gpt-4.1-mini";
  return { apiKey, model };
}

export function getDeepSeekConfig() {
  const apiKey = envString("DEEPSEEK_API_KEY");
  const model = envString("DEEPSEEK_MODEL") || "deepseek-flash";
  const baseURL = envString("DEEPSEEK_BASE_URL") || "https://api.deepseek.com";
  return { apiKey, model, baseURL };
}

export function getCoachBriefModel() {
  return envString("DEEPSEEK_COACH_BRIEF_MODEL") || getDeepSeekConfig().model;
}

export function assertDeepSeekConfigured() {
  const config = getDeepSeekConfig();
  if (!config.apiKey) {
    throw new AgentProviderError("missing_key", "The Agent isn't configured yet.");
  }
  return config;
}

export function assertGeminiConfigured() {
  const config = getGeminiConfig();
  if (!config.apiKey) {
    throw new AgentProviderError("missing_key", "The Agent isn't configured yet.");
  }
  return config;
}

export function assertOpenAIConfigured() {
  const config = getOpenAIConfig();
  if (!config.apiKey) {
    throw new AgentProviderError("missing_key", "The Agent isn't configured yet.");
  }
  return config;
}

export class AgentProviderError extends Error {
  constructor(
    public code: "missing_key" | "invalid_key" | "rate_limit" | "timeout" | "malformed" | "unavailable",
    message = "The Agent couldn't complete that request. Your form has not been changed.",
  ) {
    super(message);
    this.name = "AgentProviderError";
  }
}
