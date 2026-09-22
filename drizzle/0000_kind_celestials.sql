CREATE TYPE "public"."cap_finish" AS ENUM('silver', 'gunmetal', 'gold', 'chrome', 'black', 'gold-sphere');--> statement-breakpoint
CREATE TYPE "public"."note_layer" AS ENUM('top', 'heart', 'base');--> statement-breakpoint
CREATE TABLE "fragrance_notes" (
	"fragrance_id" integer NOT NULL,
	"note_id" integer NOT NULL,
	"layer" "note_layer" NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "fragrance_notes_fragrance_id_note_id_layer_pk" PRIMARY KEY("fragrance_id","note_id","layer")
);
--> statement-breakpoint
CREATE TABLE "fragrances" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"story" text NOT NULL,
	"mood" text NOT NULL,
	"palette" jsonb NOT NULL,
	"cap_finish" "cap_finish" NOT NULL,
	"bottle_image" text NOT NULL,
	"bottle_alt" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_signups" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"source" text DEFAULT 'site' NOT NULL,
	"consent" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"image" text NOT NULL,
	"alt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"fragrance_id" integer NOT NULL,
	"sku" text NOT NULL,
	"size_ml" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fragrance_notes" ADD CONSTRAINT "fragrance_notes_fragrance_id_fragrances_id_fk" FOREIGN KEY ("fragrance_id") REFERENCES "public"."fragrances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fragrance_notes" ADD CONSTRAINT "fragrance_notes_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_fragrance_id_fragrances_id_fk" FOREIGN KEY ("fragrance_id") REFERENCES "public"."fragrances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fragrance_notes_fragrance_idx" ON "fragrance_notes" USING btree ("fragrance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fragrances_slug_idx" ON "fragrances" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_email_idx" ON "newsletter_signups" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_slug_idx" ON "notes" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_sku_idx" ON "variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "variants_fragrance_idx" ON "variants" USING btree ("fragrance_id");