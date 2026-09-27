CREATE TABLE "flights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"theme" text,
	"notes" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"share_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "flights_user_idx" ON "flights" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flights_share_token_idx" ON "flights" USING btree ("share_token");