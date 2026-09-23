ALTER TABLE "form_draft" ADD COLUMN "client_identity_mapping" jsonb;
--> statement-breakpoint
ALTER TABLE "form_version" ADD COLUMN "client_identity_mapping" jsonb;
--> statement-breakpoint
CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"normalized_email" text NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"form_version_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"review_status" text DEFAULT 'new' NOT NULL,
	"source" text DEFAULT 'public_form' NOT NULL,
	"legacy_submission_id" text,
	"notes" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "client_workspace_idx" ON "client" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "client_workspace_email_idx" ON "client" USING btree ("workspace_id","normalized_email");
--> statement-breakpoint
CREATE INDEX "submission_workspace_idx" ON "submission" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "submission_client_idx" ON "submission" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX "submission_form_idx" ON "submission" USING btree ("form_id");
--> statement-breakpoint
CREATE INDEX "submission_form_version_idx" ON "submission" USING btree ("form_version_id");
--> statement-breakpoint
CREATE INDEX "submission_submitted_at_idx" ON "submission" USING btree ("submitted_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "submission_legacy_unique" ON "submission" USING btree ("workspace_id","legacy_submission_id") WHERE "legacy_submission_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_form_version_id_form_version_id_fk" FOREIGN KEY ("form_version_id") REFERENCES "public"."form_version"("id") ON DELETE restrict ON UPDATE no action;
