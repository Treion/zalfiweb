CREATE TABLE "discovery_set_items" (
	"set_id" integer NOT NULL,
	"fragrance_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "discovery_set_items_set_id_fragrance_id_pk" PRIMARY KEY("set_id","fragrance_id")
);
--> statement-breakpoint
CREATE TABLE "discovery_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"story" text DEFAULT '' NOT NULL,
	"image" text NOT NULL,
	"image_alt" text NOT NULL,
	"image_width" integer NOT NULL,
	"image_height" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variants" ALTER COLUMN "fragrance_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "set_id" integer;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "pieces" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "set_id" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "pieces" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "discovery_set_items" ADD CONSTRAINT "discovery_set_items_set_id_discovery_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."discovery_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_set_items" ADD CONSTRAINT "discovery_set_items_fragrance_id_fragrances_id_fk" FOREIGN KEY ("fragrance_id") REFERENCES "public"."fragrances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_sets_slug_idx" ON "discovery_sets" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_set_id_discovery_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."discovery_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_set_id_discovery_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."discovery_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "variants_set_idx" ON "variants" USING btree ("set_id");--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_one_owner" CHECK (num_nonnulls("variants"."fragrance_id", "variants"."set_id") = 1);--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_pieces_positive" CHECK ("variants"."pieces" >= 1);