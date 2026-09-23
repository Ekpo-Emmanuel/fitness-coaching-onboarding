import { GoogleGenAI } from "@google/genai";
import { AgentProviderError, assertGeminiConfigured } from "@/lib/ai/config";
import { log } from "@/lib/observability/log";

export function parseModelJson(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(trimmed) as unknown;
}

export async function generateGeminiJson(systemInstruction: string, userText: string, model?: string) {
  const config = assertGeminiConfigured();
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const response = await ai.models.generateContent({
    model: model || config.model,
    contents: userText,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      httpOptions: { timeout: 45_000 },
    },
  });
  const text = response.text?.trim();
  if (!text) throw new AgentProviderError("malformed");
  return text;
}

export function logGeminiFailure(event: string, error: unknown) {
  const record = error && typeof error === "object" ? (error as { status?: unknown; code?: unknown }) : null;
  log.error(event, {
    geminiStatus: typeof record?.status === "number" ? record.status : undefined,
    geminiCode: typeof record?.code === "string" ? record.code : undefined,
    geminiName: error instanceof Error ? error.name : undefined,
    geminiMessage: error instanceof Error ? error.message.slice(0, 240) : undefined,
  });
}

export function mapGeminiError(error: unknown): AgentProviderError {
  if (error instanceof AgentProviderError) return error;
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0;
  const message = error instanceof Error ? error.message : "";
  if (status === 401 || status === 403 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(message)) {
    return new AgentProviderError("invalid_key");
  }
  if (status === 429 || /RESOURCE_EXHAUSTED/i.test(message)) return new AgentProviderError("rate_limit");
  if (status === 504 || /DEADLINE|timeout/i.test(message) || /Timeout/i.test(error instanceof Error ? error.name : "")) {
    return new AgentProviderError("timeout");
  }
  if (error instanceof SyntaxError) return new AgentProviderError("malformed");
  return new AgentProviderError("unavailable");
}
