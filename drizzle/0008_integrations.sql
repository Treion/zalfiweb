CREATE TABLE "integrations" (
	"provider" text PRIMARY KEY NOT NULL,
	"enabled" boolean,
	"mode" text,
	"secrets" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"webhook_token" text,
	"last_check" jsonb,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;