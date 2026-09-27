ALTER TABLE "bottles" ADD COLUMN "target_price_eur" numeric;--> statement-breakpoint
ALTER TABLE "bottles" ADD COLUMN "last_checked_price_eur" numeric;--> statement-breakpoint
ALTER TABLE "bottles" ADD COLUMN "last_checked_retailer" text;--> statement-breakpoint
ALTER TABLE "bottles" ADD COLUMN "last_checked_url" text;--> statement-breakpoint
ALTER TABLE "bottles" ADD COLUMN "last_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bottles" ADD COLUMN "last_notified_at" timestamp with time zone;