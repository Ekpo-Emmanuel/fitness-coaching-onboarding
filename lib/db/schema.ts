import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
import type { ClientIdentityMapping } from "@/lib/forms/identity";
import type { ReviewRuleSet } from "@/lib/review/types";
import type { CoachBriefPayload } from "@/lib/intelligence/types";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: "date" }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export const workspace = pgTable("workspace", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
});

export const workspaceRoleValues = ["owner", "coach", "assistant"] as const;
export type WorkspaceRole = (typeof workspaceRoleValues)[number];

export const workspaceMember = pgTable(
  "workspace_member",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<WorkspaceRole>().notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [unique("workspace_member_workspace_user").on(table.workspaceId, table.userId)],
);

export const coachingProfile = pgTable("coaching_profile", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspace.id, { onDelete: "cascade" }),
  businessName: text("business_name").notNull(),
  coachName: text("coach_name").notNull(),
  coachingTypes: jsonb("coaching_types").$type<string[]>().notNull().default([]),
  targetClientDescription: text("target_client_description").notNull().default(""),
  typicalGoals: jsonb("typical_goals").$type<string[]>().notNull().default([]),
  typicalExperienceLevels: jsonb("typical_experience_levels").$type<string[]>().notNull().default([]),
  providesNutritionCoaching: boolean("provides_nutrition_coaching").notNull().default(false),
  requiresHealthScreening: boolean("requires_health_screening").notNull().default(false),
  coachingPhilosophy: text("coaching_philosophy"),
  programmingConsiderations: text("programming_considerations"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
});

export const formStatusValues = ["draft", "published", "archived"] as const;
export type FormStatus = (typeof formStatusValues)[number];

export const form = pgTable("form", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").$type<FormStatus>().notNull().default("draft"),
  activePublishedVersionId: uuid("active_published_version_id"),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
});

export const formDraft = pgTable(
  "form_draft",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => form.id, { onDelete: "cascade" }),
    schema: jsonb("schema").$type<OnboardingSchema>().notNull(),
    clientIdentityMapping: jsonb("client_identity_mapping").$type<ClientIdentityMapping>(),
    reviewRules: jsonb("review_rules").$type<ReviewRuleSet | null>(),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  },
  (table) => [unique("form_draft_form_id").on(table.formId)],
);

export const formVersion = pgTable(
  "form_version",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => form.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    schema: jsonb("schema").$type<OnboardingSchema>().notNull(),
    schemaFormatVersion: text("schema_format_version").notNull(),
    clientIdentityMapping: jsonb("client_identity_mapping").$type<ClientIdentityMapping>(),
    reviewRules: jsonb("review_rules").$type<ReviewRuleSet | null>(),
    publishedByUserId: text("published_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [unique("form_version_form_number").on(table.formId, table.versionNumber)],
);

export const reviewStatusValues = ["new", "needs_review", "reviewed"] as const;
export type ReviewStatus = (typeof reviewStatusValues)[number];

export const submissionSourceValues = ["public_form", "legacy_import"] as const;
export type SubmissionSource = (typeof submissionSourceValues)[number];

export const client = pgTable(
  "client",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    phone: text("phone"),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  },
  (table) => [
    index("client_workspace_idx").on(table.workspaceId),
    index("client_workspace_email_idx").on(table.workspaceId, table.normalizedEmail),
  ],
);

export const submission = pgTable(
  "submission",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "restrict" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => form.id, { onDelete: "restrict" }),
    formVersionId: uuid("form_version_id")
      .notNull()
      .references(() => formVersion.id, { onDelete: "restrict" }),
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull(),
    reviewStatus: text("review_status").$type<ReviewStatus>().notNull().default("new"),
    source: text("source").$type<SubmissionSource>().notNull().default("public_form"),
    legacySubmissionId: text("legacy_submission_id"),
    notes: text("notes"),
    submissionAttemptId: text("submission_attempt_id"),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("submission_workspace_idx").on(table.workspaceId),
    index("submission_client_idx").on(table.clientId),
    index("submission_form_idx").on(table.formId),
    index("submission_form_version_idx").on(table.formVersionId),
    index("submission_submitted_at_idx").on(table.submittedAt),
    index("submission_workspace_submitted_idx").on(table.workspaceId, table.submittedAt),
  ],
);

export const agentChangeSetStatusValues = ["proposed", "applied", "rejected", "superseded"] as const;
export type AgentChangeSetStatus = (typeof agentChangeSetStatusValues)[number];

export const agentThread = pgTable(
  "agent_thread",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => form.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    title: text("title"),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  },
  (table) => [
    index("agent_thread_workspace_form_idx").on(table.workspaceId, table.formId),
    unique("agent_thread_form_unique").on(table.formId),
  ],
);

export const agentChangeSet = pgTable(
  "agent_change_set",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => form.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => agentThread.id, { onDelete: "cascade" }),
    baseDraftRevision: integer("base_draft_revision").notNull(),
    status: text("status").$type<AgentChangeSetStatus>().notNull().default("proposed"),
    summary: text("summary").notNull(),
    operations: jsonb("operations").$type<unknown[]>().notNull(),
    details: jsonb("details").$type<string[]>().notNull().default([]),
    provider: text("provider"),
    model: text("model"),
    createdAt: timestamps.createdAt,
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "date" }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("agent_change_set_workspace_form_idx").on(table.workspaceId, table.formId),
    index("agent_change_set_thread_idx").on(table.threadId),
  ],
);

export const agentMessage = pgTable(
  "agent_message",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => agentThread.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    changeSetId: uuid("change_set_id").references(() => agentChangeSet.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("agent_message_thread_idx").on(table.threadId, table.createdAt)],
);

export type Workspace = typeof workspace.$inferSelect;
export type WorkspaceMember = typeof workspaceMember.$inferSelect;
export type CoachingProfile = typeof coachingProfile.$inferSelect;
export type Form = typeof form.$inferSelect;
export type FormDraft = typeof formDraft.$inferSelect;
export type FormVersion = typeof formVersion.$inferSelect;
export type Client = typeof client.$inferSelect;
export type Submission = typeof submission.$inferSelect;
export const reviewFlag = pgTable(
  "review_flag",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submission.id, { onDelete: "cascade" }),
    ruleId: text("rule_id").notNull(),
    code: text("code").notNull(),
    label: text("label").notNull(),
    sourceFieldKeys: jsonb("source_field_keys").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique("review_flag_submission_code").on(table.submissionId, table.code),
    index("review_flag_submission_idx").on(table.submissionId),
    index("review_flag_workspace_idx").on(table.workspaceId),
  ],
);

export const coachBriefStatusValues = ["pending", "processing", "complete", "failed"] as const;
export type CoachBriefStatus = (typeof coachBriefStatusValues)[number];

export const coachBrief = pgTable(
  "coach_brief",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submission.id, { onDelete: "cascade" }),
    status: text("status").$type<CoachBriefStatus>().notNull().default("pending"),
    payload: jsonb("payload").$type<CoachBriefPayload>(),
    provider: text("provider"),
    model: text("model"),
    generatedAt: timestamp("generated_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  },
  (table) => [
    unique("coach_brief_submission_unique").on(table.submissionId),
    index("coach_brief_submission_idx").on(table.submissionId),
    index("coach_brief_workspace_idx").on(table.workspaceId),
    index("coach_brief_status_idx").on(table.status),
  ],
);

export type AgentThread = typeof agentThread.$inferSelect;
export type AgentMessage = typeof agentMessage.$inferSelect;
export type AgentChangeSet = typeof agentChangeSet.$inferSelect;
export type ReviewFlag = typeof reviewFlag.$inferSelect;
export type CoachBrief = typeof coachBrief.$inferSelect;

export const integrationTypeValues = ["google_sheets", "webhook"] as const;
export type IntegrationType = (typeof integrationTypeValues)[number];
export const integrationStatusValues = ["connected", "disabled", "error"] as const;
export type IntegrationStatus = (typeof integrationStatusValues)[number];

export const integration = pgTable(
  "integration",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    type: text("type").$type<IntegrationType>().notNull(),
    name: text("name").notNull(),
    status: text("status").$type<IntegrationStatus>().notNull().default("connected"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    encryptedCredentials: text("encrypted_credentials"),
    lastError: text("last_error"),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  },
  (table) => [index("integration_workspace_idx").on(table.workspaceId)],
);

export const deliveryStatusValues = ["pending", "processing", "sent", "failed"] as const;
export type DeliveryStatus = (typeof deliveryStatusValues)[number];

export const integrationDelivery = pgTable(
  "integration_delivery",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integration.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submission.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull().default("onboarding.submitted"),
    payloadVersion: text("payload_version").notNull().default("1"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").$type<DeliveryStatus>().notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true, mode: "date" }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "date" }),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true, mode: "date" }),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    lastError: text("last_error"),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  },
  (table) => [
    unique("integration_delivery_unique").on(table.integrationId, table.submissionId, table.eventType),
    index("integration_delivery_workspace_idx").on(table.workspaceId),
    index("integration_delivery_integration_idx").on(table.integrationId),
    index("integration_delivery_submission_idx").on(table.submissionId),
    index("integration_delivery_status_idx").on(table.status),
    index("integration_delivery_due_idx").on(table.status, table.nextAttemptAt),
  ],
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspace.id, { onDelete: "set null" }),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("audit_event_workspace_idx").on(table.workspaceId, table.createdAt)],
);

export type Integration = typeof integration.$inferSelect;
export type IntegrationDelivery = typeof integrationDelivery.$inferSelect;
export type AuditEvent = typeof auditEvent.$inferSelect;
