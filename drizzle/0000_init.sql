CREATE TABLE "bottles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"distillery" text,
	"country" text,
	"region" text,
	"category" text,
	"age_statement" integer,
	"abv" numeric,
	"status" text DEFAULT 'owned' NOT NULL,
	"rating" integer,
	"purchase_price_eur" numeric,
	"purchase_store" text,
	"flavor_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"distillery" text,
	"category" text,
	"country" text,
	"flavor_profile" text,
	"reasoning" text,
	"est_price_eur" numeric,
	"retailer" text,
	"product_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bottles_user_idx" ON "bottles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_recs_user_idx" ON "saved_recommendations" USING btree ("user_id");