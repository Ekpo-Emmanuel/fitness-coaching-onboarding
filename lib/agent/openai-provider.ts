import OpenAI from "openai";
import { AgentProviderError, assertOpenAIConfigured } from "@/lib/ai/config";
import { jsonObjectInput } from "@/lib/ai/json-mode";
import { log } from "@/lib/observability/log";
import { AGENT_LIMITS } from "./limits";
import { parseAgentOperations } from "./apply-operations";
import { buildAgentContext, type FormAgentInput, type FormAgentProvider, type FormAgentResult } from "./provider";
import SYSTEM_PROMPT from "./system-prompt";

function asResult(payload: unknown): FormAgentResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AgentProviderError("malformed");
  }
  const record = payload as { assistantMessage?: unknown; operations?: unknown };
  if (typeof record.assistantMessage !== "string" || !record.assistantMessage.trim()) {
    throw new AgentProviderError("malformed");
  }
  const operations = record.operations == null ? [] : parseAgentOperations(record.operations);
  return { assistantMessage: record.assistantMessage.trim(), operations };
}

export class OpenAIFormAgentProvider implements FormAgentProvider {
  async proposeChanges(input: FormAgentInput): Promise<FormAgentResult> {
    const { apiKey, model } = assertOpenAIConfigured();
    const client = new OpenAI({ apiKey, timeout: 45_000, maxRetries: 0 });
    const context = buildAgentContext(input);
    let lastError: unknown;
    for (let attempt = 0; attempt <= AGENT_LIMITS.maxAutoRetries; attempt += 1) {
      try {
        const response = await client.responses.create({
          model,
          instructions: SYSTEM_PROMPT,
          input: jsonObjectInput(context),
          text: { format: { type: "json_object" } },
        });
        const text = response.output_text;
        if (!text) throw new AgentProviderError("malformed");
        return asResult(JSON.parse(text) as unknown);
      } catch (error) {
        lastError = error;
        if (error instanceof AgentProviderError && error.code === "malformed" && attempt < AGENT_LIMITS.maxAutoRetries) {
          continue;
        }
        logOpenAIFailure(error);
        throw mapOpenAIError(error);
      }
    }
    throw mapOpenAIError(lastError);
  }
}

function logOpenAIFailure(error: unknown) {
  const record = error && typeof error === "object" ? (error as { status?: unknown; code?: unknown; name?: unknown }) : null;
  log.error("agent_openai_failed", {
    openaiStatus: typeof record?.status === "number" ? record.status : undefined,
    openaiCode: typeof record?.code === "string" ? record.code : undefined,
    openaiName: error instanceof Error ? error.name : undefined,
    openaiMessage: error instanceof Error ? error.message.slice(0, 240) : undefined,
  });
}

function mapOpenAIError(error: unknown): AgentProviderError {
  if (error instanceof AgentProviderError) return error;
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0;
  if (status === 401 || status === 403) return new AgentProviderError("invalid_key");
  if (status === 429) return new AgentProviderError("rate_limit");
  const name = error instanceof Error ? error.name : "";
  if (name === "APIConnectionTimeoutError" || name === "TimeoutError") return new AgentProviderError("timeout");
  if (error instanceof SyntaxError) return new AgentProviderError("malformed");
  return new AgentProviderError("unavailable");
}

export function createFormAgentProvider(): FormAgentProvider {
  return new OpenAIFormAgentProvider();
}
