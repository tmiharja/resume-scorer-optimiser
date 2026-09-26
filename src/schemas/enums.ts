import { z } from "zod";

/**
 * Categorical analytics fields. Constrained enums (not free text) so nothing
 * personally identifying can reach the analytics table (PLAN.md §7).
 */
export const ROLE_FAMILIES = [
  "software_eng",
  "data_analytics",
  "product",
  "design",
  "marketing",
  "sales_bd",
  "finance_accounting",
  "operations_supply_chain",
  "hr",
  "consulting",
  "legal",
  "healthcare",
  "education",
  "engineering_other",
  "admin",
  "customer_service",
  "research_science",
  "other",
  "unknown",
] as const;

export const SENIORITIES = [
  "intern",
  "entry",
  "mid",
  "senior",
  "lead_manager",
  "director_plus",
  "unknown",
] as const;

export const INDUSTRIES = [
  "tech",
  "finance_banking",
  "consulting",
  "public_sector",
  "healthcare",
  "education",
  "manufacturing",
  "logistics",
  "retail_ecommerce",
  "media_marketing",
  "real_estate",
  "energy",
  "hospitality",
  "telco",
  "other",
  "unknown",
] as const;

export const YOE_BUCKETS = ["0-1", "2-4", "5-9", "10-14", "15+", "unknown"] as const;

export const ANALYSIS_STATUSES = ["success", "partial", "rejected_not_resume", "error"] as const;

export const roleFamily = z.enum(ROLE_FAMILIES);
export const seniority = z.enum(SENIORITIES);
export const industry = z.enum(INDUSTRIES);
export const yoeBucket = z.enum(YOE_BUCKETS);

export type RoleFamily = z.infer<typeof roleFamily>;
export type Seniority = z.infer<typeof seniority>;
export type Industry = z.infer<typeof industry>;
export type YoeBucket = z.infer<typeof yoeBucket>;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];
