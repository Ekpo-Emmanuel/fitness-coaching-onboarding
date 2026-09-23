-- Phase 7 workspace integrations and delivery attempts
CREATE TABLE "integration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"encrypted_credentials" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"event_type" text DEFAULT 'onboarding.submitted' NOT NULL,
	"payload_version" text DEFAULT '1' NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "integration_delivery" ADD CONSTRAINT "integration_delivery_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "integration_delivery" ADD CONSTRAINT "integration_delivery_integration_id_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integration"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "integration_delivery" ADD CONSTRAINT "integration_delivery_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "integration_workspace_idx" ON "integration" USING btree ("workspace_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "integration_delivery_unique" ON "integration_delivery" USING btree ("integration_id","submission_id","event_type");
--> statement-breakpoint
CREATE INDEX "integration_delivery_workspace_idx" ON "integration_delivery" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "integration_delivery_integration_idx" ON "integration_delivery" USING btree ("integration_id");
--> statement-breakpoint
CREATE INDEX "integration_delivery_submission_idx" ON "integration_delivery" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX "integration_delivery_status_idx" ON "integration_delivery" USING btree ("status");
