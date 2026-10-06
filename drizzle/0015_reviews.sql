CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"order_item_id" integer NOT NULL,
	"fragrance_id" integer,
	"set_id" integer,
	"rating" smallint NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"display_name" text NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"reply" text,
	"replied_at" timestamp with time zone,
	"moderated_by" text,
	"moderated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "review_asked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_fragrance_id_fragrances_id_fk" FOREIGN KEY ("fragrance_id") REFERENCES "public"."fragrances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_set_id_discovery_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."discovery_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_admin_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_order_item_idx" ON "reviews" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "reviews_fragrance_idx" ON "reviews" USING btree ("fragrance_id","status");--> statement-breakpoint
CREATE INDEX "reviews_set_idx" ON "reviews" USING btree ("set_id","status");--> statement-breakpoint
CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status","created_at");