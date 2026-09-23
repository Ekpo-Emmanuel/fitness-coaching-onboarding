-- Phase 6 review rules, review flags, and coach briefs
ALTER TABLE "form_draft" ADD COLUMN "review_rules" jsonb;
--> statement-breakpoint
ALTER TABLE "form_version" ADD COLUMN "review_rules" jsonb;
--> statement-breakpoint
CREATE TABLE "review_flag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"source_field_keys" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_brief" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"provider" text,
	"model" text,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_flag" ADD CONSTRAINT "review_flag_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "review_flag" ADD CONSTRAINT "review_flag_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "coach_brief" ADD CONSTRAINT "coach_brief_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "coach_brief" ADD CONSTRAINT "coach_brief_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "review_flag_submission_code" ON "review_flag" USING btree ("submission_id","code");
--> statement-breakpoint
CREATE INDEX "review_flag_submission_idx" ON "review_flag" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX "review_flag_workspace_idx" ON "review_flag" USING btree ("workspace_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "coach_brief_submission_unique" ON "coach_brief" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX "coach_brief_submission_idx" ON "coach_brief" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX "coach_brief_workspace_idx" ON "coach_brief" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "coach_brief_status_idx" ON "coach_brief" USING btree ("status");
