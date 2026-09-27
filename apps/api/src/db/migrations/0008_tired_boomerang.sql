ALTER TABLE "organization_invitations" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD COLUMN "invitation_method" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD COLUMN "invited_by" text;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;