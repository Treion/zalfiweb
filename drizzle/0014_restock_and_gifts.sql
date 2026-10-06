CREATE TABLE "restock_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"variant_id" integer NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gift_message" text;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "restock_requests_open_idx" ON "restock_requests" USING btree ("variant_id","phone") WHERE "restock_requests"."notified_at" is null;--> statement-breakpoint
CREATE INDEX "restock_requests_variant_idx" ON "restock_requests" USING btree ("variant_id");