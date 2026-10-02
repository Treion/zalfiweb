ALTER TABLE "variants" ADD COLUMN "price_poisha" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "low_stock_threshold" integer;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Carry the placeholder USD prices over to taka placeholders (rounded to ৳50) until the owner sets
-- real prices in the admin: $145 → ৳4,500, $165 → ৳5,100, $185 → ৳5,750.
UPDATE "variants" SET "price_poisha" = round("price_cents" * 31 / 5000.0) * 5000;
