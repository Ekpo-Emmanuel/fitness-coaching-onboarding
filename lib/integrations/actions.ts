"use server";

import { getPoolDb } from "@/lib/db/node";
import { FormServiceError } from "@/lib/forms/errors";
import {
  createWebhookIntegration,
  disconnectGoogle,
  rotateWebhookSecret,
  retryDelivery,
  retryFailedForIntegration,
  saveGoogleSpreadsheet,
  sendWebhookTest,
  setIntegrationStatus,
  testGoogleConnection,
} from "@/lib/integrations/service";
import { requireWorkspace } from "@/lib/workspace/session";

function asError(error: unknown) {
  if (error instanceof FormServiceError) return { error: error.message };
  return { error: "Could not update that connection." };
}

export async function createWebhookAction(input: { name: string; endpointUrl: string }) {
  const { workspace } = await requireWorkspace();
  try {
    const created = await createWebhookIntegration(getPoolDb(), workspace.id, input);
    return { ok: true as const, integration: created.integration, signingSecret: created.signingSecret };
  } catch (error) {
    return asError(error);
  }
}

export async function rotateWebhookAction(integrationId: string) {
  const { workspace } = await requireWorkspace();
  try {
    const rotated = await rotateWebhookSecret(getPoolDb(), workspace.id, integrationId);
    return { ok: true as const, signingSecret: rotated.signingSecret };
  } catch (error) {
    return asError(error);
  }
}

export async function setStatusAction(integrationId: string, status: "connected" | "disabled") {
  const { workspace } = await requireWorkspace();
  try {
    const integration = await setIntegrationStatus(getPoolDb(), workspace.id, integrationId, status);
    return { ok: true as const, integration };
  } catch (error) {
    return asError(error);
  }
}

export async function disconnectGoogleAction(integrationId: string) {
  const { workspace } = await requireWorkspace();
  try {
    const integration = await disconnectGoogle(getPoolDb(), workspace.id, integrationId);
    return { ok: true as const, integration };
  } catch (error) {
    return asError(error);
  }
}

export async function saveSpreadsheetAction(integrationId: string, input: { spreadsheetId?: string; create?: boolean }) {
  const { workspace } = await requireWorkspace();
  try {
    const integration = await saveGoogleSpreadsheet(getPoolDb(), workspace.id, integrationId, input);
    return { ok: true as const, integration };
  } catch (error) {
    return asError(error);
  }
}

export async function testGoogleAction(integrationId: string) {
  const { workspace } = await requireWorkspace();
  try {
    const result = await testGoogleConnection(getPoolDb(), workspace.id, integrationId);
    return { ok: true as const, title: result.title };
  } catch (error) {
    return asError(error);
  }
}

export async function testWebhookAction(integrationId: string) {
  const { workspace } = await requireWorkspace();
  try {
    await sendWebhookTest(getPoolDb(), workspace.id, integrationId);
    return { ok: true as const };
  } catch (error) {
    return asError(error);
  }
}

export async function retryDeliveryAction(deliveryId: string) {
  const { workspace } = await requireWorkspace();
  try {
    const delivery = await retryDelivery(getPoolDb(), workspace.id, deliveryId);
    return { ok: true as const, status: delivery.status, lastError: delivery.lastError };
  } catch (error) {
    return asError(error);
  }
}

export async function retryFailedAction(integrationId: string) {
  const { workspace } = await requireWorkspace();
  try {
    await retryFailedForIntegration(getPoolDb(), workspace.id, integrationId);
    return { ok: true as const };
  } catch (error) {
    return asError(error);
  }
}
