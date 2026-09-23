import { AgentProviderError } from "@/lib/ai/config";
import { generateGeminiJson, logGeminiFailure, mapGeminiError, parseModelJson } from "@/lib/ai/gemini";
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

export class GeminiFormAgentProvider implements FormAgentProvider {
  async proposeChanges(input: FormAgentInput): Promise<FormAgentResult> {
    const context = buildAgentContext(input);
    let lastError: unknown;
    for (let attempt = 0; attempt <= AGENT_LIMITS.maxAutoRetries; attempt += 1) {
      try {
        const text = await generateGeminiJson(SYSTEM_PROMPT, JSON.stringify(context));
        return asResult(parseModelJson(text));
      } catch (error) {
        lastError = error;
        if (error instanceof AgentProviderError && error.code === "malformed" && attempt < AGENT_LIMITS.maxAutoRetries) {
          continue;
        }
        logGeminiFailure("agent_gemini_failed", error);
        throw mapGeminiError(error);
      }
    }
    throw mapGeminiError(lastError);
  }
}

export function createFormAgentProvider(): FormAgentProvider {
  return new GeminiFormAgentProvider();
}
