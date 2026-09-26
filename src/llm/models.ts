import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel, generateText } from "ai";
import type { Env } from "@/env";
import type { ModelId } from "./pricing";

export const AGENTS = ["extractor", "critic", "matcher", "rewriter", "verifier"] as const;
export type Agent = (typeof AGENTS)[number];

export type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]["providerOptions"]>;

export type AgentModel = {
  /** Model ID used for pricing and analytics. */
  id: ModelId;
  model: LanguageModel;
  providerOptions?: ProviderOptions;
};

export type AgentModels = Record<Agent, AgentModel>;

/**
 * Per-model request options. Sonnet 5 runs adaptive thinking unless told
 * otherwise; these are short structured-extraction tasks, so it's disabled to
 * keep cost and latency predictable. Haiku 4.5 doesn't think unless asked.
 */
const MODEL_OPTIONS: Partial<Record<ModelId, ProviderOptions>> = {
  "claude-sonnet-5": { anthropic: { thinking: { type: "disabled" } } },
};

const ENV_KEYS: Record<Agent, keyof Env> = {
  extractor: "MODEL_EXTRACTOR",
  critic: "MODEL_CRITIC",
  matcher: "MODEL_MATCHER",
  rewriter: "MODEL_REWRITER",
  verifier: "MODEL_VERIFIER",
};

/** Resolves each agent's model from env (MODEL_*), or the mock layer when LLM_MOCK=1. */
export async function resolveModels(env: Env): Promise<AgentModels> {
  if (env.LLM_MOCK) {
    const { mockAgentModels } = await import("./mock");
    return mockAgentModels();
  }
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set (set LLM_MOCK=1 to run without the API)");
  }
  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const models = {} as AgentModels;
  for (const agent of Object.keys(ENV_KEYS) as Agent[]) {
    const id = env[ENV_KEYS[agent]] as ModelId;
    models[agent] = { id, model: anthropic(id), providerOptions: MODEL_OPTIONS[id] };
  }
  return models;
}
