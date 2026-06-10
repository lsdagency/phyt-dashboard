CREATE TABLE "app_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"status" varchar(16) NOT NULL,
	"error" text,
	"optimisation_id" integer
);
--> statement-breakpoint
CREATE TABLE "kpi_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"metric" varchar(64) NOT NULL,
	"target" real NOT NULL,
	"direction" varchar(8) DEFAULT 'up' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kpi_targets_metric_unique" UNIQUE("metric")
);
--> statement-breakpoint
CREATE TABLE "metric_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(32) NOT NULL,
	"cache_key" varchar(160) NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "optimisations" (
	"id" serial PRIMARY KEY NOT NULL,
	"for_date" date NOT NULL,
	"recommendations" jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"model" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(120) DEFAULT '' NOT NULL,
	"role" varchar(16) DEFAULT 'client' NOT NULL,
	"receives_daily_report" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "metric_cache_key_idx" ON "metric_cache" USING btree ("source","cache_key");