-- Phase 8 production hardening: idempotency, delivery retry, audit
ALTER TABLE "submission" ADD COLUMN "submission_attempt_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "submission_attempt_unique" ON "submission" USING btree ("form_version_id","submission_attempt_id") WHERE "submission_attempt_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "submission_workspace_submitted_idx" ON "submission" USING btree ("workspace_id","submitted_at");
--> statement-breakpoint
ALTER TABLE "integration_delivery" ADD COLUMN "next_attempt_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "integration_delivery" ADD COLUMN "processing_started_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "integration_delivery_due_idx" ON "integration_delivery" USING btree ("status","next_attempt_at");
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"actor_user_id" text,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "audit_event_workspace_idx" ON "audit_event" USING btree ("workspace_id","created_at");
