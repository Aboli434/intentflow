CREATE TABLE "project_member_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "assigned_by" text;--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_member_activity" ADD CONSTRAINT "project_member_activity_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member_activity" ADD CONSTRAINT "project_member_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member_activity" ADD CONSTRAINT "project_member_activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pma_project_id_idx" ON "project_member_activity" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pma_user_id_idx" ON "project_member_activity" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_members_project_id_idx" ON "project_members" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_members_user_id_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_members_role_idx" ON "project_members" USING btree ("role");