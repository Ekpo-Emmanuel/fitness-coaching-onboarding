import OpenAI from "openai";
import { AgentProviderError, assertDeepSeekConfigured } from "@/lib/ai/config";
import { jsonObjectInput } from "@/lib/ai/json-mode";
import { log } from "@/lib/observability/log";

export function parseModelJson(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(trimmed) as unknown;
}

export async function generateDeepSeekJson(systemInstruction: string, payload: unknown, model?: string) {
  const config = assertDeepSeekConfigured();
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: 60_000,
    maxRetries: 0,
  });
  const response = await client.chat.completions.create(
    {
      model: model || config.model,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: jsonObjectInput(payload) },
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
    { extraBody: { thinking: { type: "disabled" } } } as never,
  );
  const text = response.choices[0]?.message?.content?.trim();
  if (!text) throw new AgentProviderError("malformed");
  return text;
}

export function logDeepSeekFailure(event: string, error: unknown) {
  const record = error && typeof error === "object" ? (error as { status?: unknown; code?: unknown }) : null;
  log.error(event, {
    deepseekStatus: typeof record?.status === "number" ? record.status : undefined,
    deepseekCode: typeof record?.code === "string" ? record.code : undefined,
    deepseekName: error instanceof Error ? error.name : undefined,
    deepseekMessage: error instanceof Error ? error.message.slice(0, 240) : undefined,
  });
}

export function mapDeepSeekError(error: unknown): AgentProviderError {
  if (error instanceof AgentProviderError) return error;
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0;
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = error instanceof Error ? error.message : "";
  if (status === 401 || status === 403) return new AgentProviderError("invalid_key");
  if (status === 402 || status === 429 || /insufficient_quota|credit/i.test(code) || /insufficient_quota|credit/i.test(message)) {
    return new AgentProviderError("rate_limit");
  }
  const name = error instanceof Error ? error.name : "";
  if (name === "APIConnectionTimeoutError" || name === "TimeoutError") return new AgentProviderError("timeout");
  if (error instanceof SyntaxError) return new AgentProviderError("malformed");
  return new AgentProviderError("unavailable");
}
