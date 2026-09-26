CREATE TYPE "public"."industry" AS ENUM('tech', 'finance_banking', 'consulting', 'public_sector', 'healthcare', 'education', 'manufacturing', 'logistics', 'retail_ecommerce', 'media_marketing', 'real_estate', 'energy', 'hospitality', 'telco', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."region" AS ENUM('SG');--> statement-breakpoint
CREATE TYPE "public"."role_family" AS ENUM('software_eng', 'data_analytics', 'product', 'design', 'marketing', 'sales_bd', 'finance_accounting', 'operations_supply_chain', 'hr', 'consulting', 'legal', 'healthcare', 'education', 'engineering_other', 'admin', 'customer_service', 'research_science', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."seniority" AS ENUM('intern', 'entry', 'mid', 'senior', 'lead_manager', 'director_plus', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."analysis_status" AS ENUM('success', 'partial', 'rejected_not_resume', 'error');--> statement-breakpoint
CREATE TYPE "public"."yoe_bucket" AS ENUM('0-1', '2-4', '5-9', '10-14', '15+', 'unknown');--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"region" "region" DEFAULT 'SG' NOT NULL,
	"role_family" "role_family",
	"seniority" "seniority",
	"industry" "industry",
	"yoe_bucket" "yoe_bucket",
	"page_count" smallint NOT NULL,
	"overall_score" smallint,
	"dimension_scores" jsonb,
	"jd_provided" boolean NOT NULL,
	"jd_match_score" smallint,
	"injection_flagged" boolean NOT NULL,
	"rubric_version" text NOT NULL,
	"models" jsonb NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"latency_ms" integer NOT NULL,
	"status" "analysis_status" NOT NULL,
	CONSTRAINT "page_count_range" CHECK ("analyses"."page_count" between 1 and 4),
	CONSTRAINT "overall_score_range" CHECK ("analyses"."overall_score" is null or "analyses"."overall_score" between 0 and 100),
	CONSTRAINT "jd_match_range" CHECK ("analyses"."jd_match_score" is null or "analyses"."jd_match_score" between 0 and 100),
	CONSTRAINT "rubric_version_format" CHECK ("analyses"."rubric_version" ~ '^[a-z]{2}-[0-9]{4}\.[0-9]{2}\.[0-9]+$')
);
