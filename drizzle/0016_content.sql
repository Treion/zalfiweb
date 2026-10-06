CREATE TYPE "public"."product_badge" AS ENUM('new', 'bestseller', 'limited');--> statement-breakpoint
CREATE TYPE "public"."banner_placement" AS ENUM('shop', 'home');--> statement-breakpoint
CREATE TYPE "public"."banner_tone" AS ENUM('light', 'dark');--> statement-breakpoint
CREATE TABLE "banners" (
	"id" serial PRIMARY KEY NOT NULL,
	"placement" "banner_placement" NOT NULL,
	"image" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"mobile_image" text,
	"mobile_width" integer,
	"mobile_height" integer,
	"alt" text NOT NULL,
	"headline" text,
	"line" text,
	"button_label" text,
	"link" text,
	"tone" "banner_tone" DEFAULT 'light' NOT NULL,
	"text_in_image" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"youtube_id" text NOT NULL,
	"title" text NOT NULL,
	"channel" text,
	"fragrance_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fragrances" ADD COLUMN "badge" "product_badge";--> statement-breakpoint
ALTER TABLE "fragrances" ADD COLUMN "how_to_wear" text;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_fragrance_id_fragrances_id_fk" FOREIGN KEY ("fragrance_id") REFERENCES "public"."fragrances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "banners_placement_idx" ON "banners" USING btree ("placement","active","sort_order");--> statement-breakpoint
CREATE INDEX "videos_fragrance_idx" ON "videos" USING btree ("fragrance_id","active");