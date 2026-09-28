ALTER TABLE "organization_invitations" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD COLUMN "delivery_status" text;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD COLUMN "last_delivery_attempt" timestamp;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "uploaded_by" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "related_entity_type" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "related_entity_id" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;