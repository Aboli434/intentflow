CREATE TABLE "project_closures" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"summary" text,
	"completion_notes" text,
	"created_by" text NOT NULL,
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"approved_by" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closure_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"closure_id" text NOT NULL,
	"client_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "closure_revision_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"closure_id" text NOT NULL,
	"client_id" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "project_handoffs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"closure_id" text NOT NULL,
	"handoff_status" text DEFAULT 'pending' NOT NULL,
	"summary" text,
	"deliverables_count" integer DEFAULT 0 NOT NULL,
	"completed_work_count" integer DEFAULT 0 NOT NULL,
	"approved_deliverables_count" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"delivered_at" timestamp,
	"acknowledged_at" timestamp,
	"acknowledged_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handoff_items" (
	"id" text PRIMARY KEY NOT NULL,
	"handoff_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"reference_id" text,
	"reference_url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_completion_checklist" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"completed_by" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_closures" ADD CONSTRAINT "project_closures_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_closures" ADD CONSTRAINT "project_closures_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_closures" ADD CONSTRAINT "project_closures_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closure_reviews" ADD CONSTRAINT "closure_reviews_closure_id_project_closures_id_fk" FOREIGN KEY ("closure_id") REFERENCES "public"."project_closures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closure_reviews" ADD CONSTRAINT "closure_reviews_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closure_revision_requests" ADD CONSTRAINT "closure_revision_requests_closure_id_project_closures_id_fk" FOREIGN KEY ("closure_id") REFERENCES "public"."project_closures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closure_revision_requests" ADD CONSTRAINT "closure_revision_requests_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closure_revision_requests" ADD CONSTRAINT "closure_revision_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_handoffs" ADD CONSTRAINT "project_handoffs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_handoffs" ADD CONSTRAINT "project_handoffs_closure_id_project_closures_id_fk" FOREIGN KEY ("closure_id") REFERENCES "public"."project_closures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_handoffs" ADD CONSTRAINT "project_handoffs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_handoffs" ADD CONSTRAINT "project_handoffs_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_items" ADD CONSTRAINT "handoff_items_handoff_id_project_handoffs_id_fk" FOREIGN KEY ("handoff_id") REFERENCES "public"."project_handoffs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_completion_checklist" ADD CONSTRAINT "project_completion_checklist_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_completion_checklist" ADD CONSTRAINT "project_completion_checklist_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;