CREATE TABLE "value_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"purchase_value_eur" numeric NOT NULL,
	"owned_count" integer NOT NULL,
	"market_value_eur" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "value_snapshots_user_date_idx" ON "value_snapshots" USING btree ("user_id","date");