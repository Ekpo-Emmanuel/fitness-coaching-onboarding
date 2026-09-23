import { AgentProviderError } from "@/lib/ai/config";
import { generateDeepSeekJson, logDeepSeekFailure, mapDeepSeekError, parseModelJson } from "@/lib/ai/deepseek";
import { AgentOperationError, parseAgentOperations } from "./apply-operations";
import { AGENT_LIMITS } from "./limits";
import { buildAgentContext, type FormAgentInput, type FormAgentProvider, type FormAgentResult } from "./provider";
import SYSTEM_PROMPT from "./system-prompt";

function coachMessage(payload: { assistantMessage?: unknown; message?: unknown }) {
  if (typeof payload.assistantMessage === "string" && payload.assistantMessage.trim()) {
    return payload.assistantMessage.trim();
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  return "";
}

function asResult(payload: unknown, lastAttempt: boolean): FormAgentResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AgentProviderError("malformed");
  }
  const record = payload as { assistantMessage?: unknown; message?: unknown; operations?: unknown };
  const assistantMessage = coachMessage(record);
  if (!assistantMessage) {
    throw new AgentProviderError("malformed");
  }
  try {
    const operations = record.operations == null ? [] : parseAgentOperations(record.operations);
    return { assistantMessage, operations };
  } catch (error) {
    if (error instanceof AgentOperationError && lastAttempt) {
      return {
        assistantMessage: `${assistantMessage}\n\nI couldn't turn that into a safe draft change. Your form has not been changed.`,
        operations: [],
      };
    }
    throw error instanceof AgentOperationError ? new AgentProviderError("malformed") : error;
  }
}

export function formAgentResultFromJson(payload: unknown, lastAttempt = false) {
  return asResult(payload, lastAttempt);
}

export class DeepSeekFormAgentProvider implements FormAgentProvider {
  async proposeChanges(input: FormAgentInput): Promise<FormAgentResult> {
    const context = buildAgentContext(input);
    let lastError: unknown;
    for (let attempt = 0; attempt <= AGENT_LIMITS.maxAutoRetries; attempt += 1) {
      try {
        const text = await generateDeepSeekJson(SYSTEM_PROMPT, context);
        return asResult(parseModelJson(text), attempt === AGENT_LIMITS.maxAutoRetries);
      } catch (error) {
        lastError = error;
        const retryable =
          (error instanceof AgentProviderError && error.code === "malformed") ||
          error instanceof AgentOperationError;
        if (retryable && attempt < AGENT_LIMITS.maxAutoRetries) {
          continue;
        }
        logDeepSeekFailure("agent_deepseek_failed", error);
        throw error instanceof AgentProviderError ? error : mapDeepSeekError(error);
      }
    }
    throw mapDeepSeekError(lastError);
  }
}

export function createFormAgentProvider(): FormAgentProvider {
  return new DeepSeekFormAgentProvider();
}
