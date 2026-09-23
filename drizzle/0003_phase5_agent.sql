-- Phase 5 Agent thread, messages, and change sets
CREATE TABLE "agent_thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"created_by_user_id" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_change_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"base_draft_revision" integer NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"summary" text NOT NULL,
	"operations" jsonb NOT NULL,
	"details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" text,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone,
	"rejected_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"change_set_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_thread_workspace_form_idx" ON "agent_thread" USING btree ("workspace_id","form_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_thread_form_unique" ON "agent_thread" USING btree ("form_id");
--> statement-breakpoint
CREATE INDEX "agent_change_set_workspace_form_idx" ON "agent_change_set" USING btree ("workspace_id","form_id");
--> statement-breakpoint
CREATE INDEX "agent_change_set_thread_idx" ON "agent_change_set" USING btree ("thread_id");
--> statement-breakpoint
CREATE INDEX "agent_message_thread_idx" ON "agent_message" USING btree ("thread_id","created_at");
--> statement-breakpoint
ALTER TABLE "agent_thread" ADD CONSTRAINT "agent_thread_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_thread" ADD CONSTRAINT "agent_thread_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_thread" ADD CONSTRAINT "agent_thread_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_change_set" ADD CONSTRAINT "agent_change_set_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_change_set" ADD CONSTRAINT "agent_change_set_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_change_set" ADD CONSTRAINT "agent_change_set_thread_id_agent_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."agent_thread"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_message" ADD CONSTRAINT "agent_message_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_message" ADD CONSTRAINT "agent_message_thread_id_agent_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."agent_thread"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_message" ADD CONSTRAINT "agent_message_change_set_id_agent_change_set_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "public"."agent_change_set"("id") ON DELETE set null ON UPDATE no action;
