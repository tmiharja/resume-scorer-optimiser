import { z } from "zod";

// Public, non-secret site config. NEXT_PUBLIC_* values are inlined at build time.
const portfolioUrl = z.url().safeParse(process.env.NEXT_PUBLIC_PORTFOLIO_URL);

export const site = {
  name: "Resume Optimiser",
  description:
    "Free resume feedback for Singapore and SEA job seekers: a score, specific fixes and stronger bullet points in about a minute.",
  credit: "toninmotion",
  portfolioUrl: portfolioUrl.success ? portfolioUrl.data : undefined,
} as const;
