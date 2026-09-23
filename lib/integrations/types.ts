export type IntegrationType = "google_sheets" | "webhook";
export type IntegrationStatus = "connected" | "disabled" | "error";
export type DeliveryStatus = "pending" | "processing" | "sent" | "failed";

export type OnboardingSubmittedEventV1 = {
  event: "onboarding.submitted";
  payloadVersion: "1";
  deliveryId: string;
  occurredAt: string;
  client: {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
  };
  form: {
    id: string;
    name: string;
    versionNumber: number;
  };
  submission: {
    id: string;
    submittedAt: string;
    reviewStatus: string;
    answers: Record<string, unknown>;
  };
  reviewFlags: Array<{
    code: string;
    label: string;
    sourceFieldKeys: string[];
  }>;
  fields: Array<{
    sectionKey: string;
    sectionTitle: string;
    fieldKey: string;
    fieldLabel: string;
    fieldType: string;
  }>;
};

export type DeliveryResult = {
  ok: boolean;
  error?: string;
  reconnect?: boolean;
};

export type IntegrationContext = {
  id: string;
  workspaceId: string;
  type: IntegrationType;
  name: string;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  credentials: Record<string, unknown> | null;
};

export interface SubmissionDestination {
  deliver(integration: IntegrationContext, payload: Record<string, unknown>): Promise<DeliveryResult>;
}
