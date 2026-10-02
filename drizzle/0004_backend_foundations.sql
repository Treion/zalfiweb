CREATE TYPE "public"."courier_name" AS ENUM('mock', 'pathao', 'steadfast');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'delivery_failed', 'return_requested', 'returned');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('sslcommerz', 'cod');--> statement-breakpoint
CREATE TYPE "public"."payment_record_status" AS ENUM('initiated', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'paid', 'failed', 'partially_refunded', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."shipping_zone" AS ENUM('inside_dhaka', 'outside_dhaka');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('initial', 'sale', 'cancel_restock', 'return_restock', 'manual_adjustment');--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('owner', 'manager');--> statement-breakpoint
CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE TABLE "fragrance_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"fragrance_id" integer NOT NULL,
	"url" text NOT NULL,
	"alt" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"percent_off" integer,
	"max_discount" integer,
	"amount_off" integer,
	"free_shipping" boolean DEFAULT false NOT NULL,
	"min_subtotal" integer,
	"first_order_only" boolean DEFAULT false NOT NULL,
	"usage_limit" integer,
	"per_customer_limit" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"fragrance_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"variant_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_percent_range" CHECK ("coupons"."percent_off" is null or "coupons"."percent_off" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"district" text NOT NULL,
	"area" text NOT NULL,
	"street" text NOT NULL,
	"zone" "shipping_zone" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"message" text DEFAULT '' NOT NULL,
	"data" jsonb,
	"actor" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"variant_id" integer,
	"fragrance_id" integer,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"size_ml" integer NOT NULL,
	"unit_price" integer DEFAULT 0 NOT NULL,
	"qty" integer NOT NULL,
	"line_total" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text DEFAULT 'ZLF-' || lpad(nextval('order_number_seq')::text, 6, '0') NOT NULL,
	"idempotency_key" text NOT NULL,
	"access_token" text NOT NULL,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text NOT NULL,
	"address_district" text NOT NULL,
	"address_area" text NOT NULL,
	"address_street" text NOT NULL,
	"zone" "shipping_zone" NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"shipping_fee" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"coupon_id" integer,
	"coupon_code" text,
	"payment_method" "payment_method" NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"courier" "courier_name",
	"tracking_code" text,
	"internal_notes" text DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"packed_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"out_for_delivery_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"delivery_failed_at" timestamp with time zone,
	"return_requested_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"receipt_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_total_nonnegative" CHECK ("orders"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"provider" text NOT NULL,
	"tran_id" text NOT NULL,
	"val_id" text,
	"amount" integer DEFAULT 0 NOT NULL,
	"status" "payment_record_status" DEFAULT 'initiated' NOT NULL,
	"method_reported" text,
	"validation" jsonb,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_otps" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"verified_at" timestamp with time zone,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"payment_id" integer,
	"amount" integer DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"provider_ref" text,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"issued_by" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"items" jsonb NOT NULL,
	"reason" text NOT NULL,
	"condition" text DEFAULT '' NOT NULL,
	"restocked" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"courier" "courier_name" NOT NULL,
	"consignment_id" text,
	"tracking_code" text,
	"status" text DEFAULT 'created' NOT NULL,
	"cod_amount" integer DEFAULT 0 NOT NULL,
	"label_url" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"raw" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"variant_id" integer NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"delta" integer NOT NULL,
	"reason" text,
	"order_id" integer,
	"admin_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"qty" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" "admin_role" DEFAULT 'manager' NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by" text,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "admin_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "admin_two_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "admin_role" DEFAULT 'manager' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "admin_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_email" text,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fragrance_images" ADD CONSTRAINT "fragrance_images_fragrance_id_fragrances_id_fk" FOREIGN KEY ("fragrance_id") REFERENCES "public"."fragrances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_fragrance_id_fragrances_id_fk" FOREIGN KEY ("fragrance_id") REFERENCES "public"."fragrances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_issued_by_admin_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_accounts" ADD CONSTRAINT "admin_accounts_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_invited_by_admin_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_two_factors" ADD CONSTRAINT "admin_two_factors_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fragrance_images_fragrance_idx" ON "fragrance_images" USING btree ("fragrance_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_idx" ON "coupons" USING btree (upper("code"));--> statement-breakpoint
CREATE INDEX "customer_addresses_customer_idx" ON "customer_addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_variant_idx" ON "order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_idx" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_idx" ON "orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_access_token_idx" ON "orders" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_phone_idx" ON "orders" USING btree ("customer_phone");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_tran_idx" ON "payments" USING btree ("tran_id");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "phone_otps_phone_idx" ON "phone_otps" USING btree ("phone","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "phone_verifications_token_idx" ON "phone_verifications" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refunds_order_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "returns_order_idx" ON "returns" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "shipments_order_idx" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "shipments_consignment_idx" ON "shipments" USING btree ("courier","consignment_id");--> statement-breakpoint
CREATE INDEX "stock_movements_variant_idx" ON "stock_movements" USING btree ("variant_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_order_idx" ON "stock_movements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "stock_reservations_active_idx" ON "stock_reservations" USING btree ("variant_id") WHERE "stock_reservations"."released_at" is null;--> statement-breakpoint
CREATE INDEX "stock_reservations_order_idx" ON "stock_reservations" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_unique_idx" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "admin_accounts_user_idx" ON "admin_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitations_token_idx" ON "admin_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_invitations_email_idx" ON "admin_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "admin_sessions_user_idx" ON "admin_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "admin_two_factors_user_idx" ON "admin_two_factors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "admin_two_factors_secret_idx" ON "admin_two_factors" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "admin_verifications_identifier_idx" ON "admin_verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
ALTER TABLE "variants" DROP COLUMN "price_cents";--> statement-breakpoint
ALTER TABLE "variants" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_stock_nonnegative" CHECK ("variants"."stock" >= 0);--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_price_nonnegative" CHECK ("variants"."price_poisha" >= 0);--> statement-breakpoint
-- Open the stock ledger: today's stock becomes each size's opening balance
INSERT INTO "stock_movements" ("variant_id", "type", "delta", "reason")
SELECT "id", 'initial', "stock", 'Opening stock' FROM "variants" WHERE "stock" <> 0;
