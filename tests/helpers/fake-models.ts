import { MockLanguageModelV4 } from "ai/test";
import { MOCK_OUTPUTS } from "@/llm/mock";
import type { Agent, AgentModels } from "@/llm/models";

/** What a fake agent returns: JSON, raw text (e.g. invalid JSON), or an error. */
export type FakeReply = object | { raw: string } | { error: Error } | { hang: true };

export type FakeScript = Partial<Record<Agent, FakeReply | FakeReply[]>>;

export type CallLog = {
  agent: Agent;
  system: string;
  prompt: string;
  start: number;
  end: number;
}[];

const AGENT_ORDER: Agent[] = ["extractor", "critic", "matcher", "rewriter", "verifier"];

function waitOrAbort(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/**
 * Per-agent fake models. Defaults to the canned mock outputs; `script`
 * overrides replies per agent (an array is consumed one reply per call).
 */
export function fakeModels(script: FakeScript = {}, delayMs = 5) {
  const calls: CallLog = [];
  const counters: Partial<Record<Agent, number>> = {};

  const modelFor = (agent: Agent) =>
    new MockLanguageModelV4({
      provider: "fake",
      modelId: agent,
      doGenerate: async ({ prompt, abortSignal }) => {
        const start = Date.now();
        const system = prompt
          .filter((m) => m.role === "system")
          .map((m) => String(m.content))
          .join("\n");
        const user = prompt
          .filter((m) => m.role === "user")
          .map((m) =>
            Array.isArray(m.content)
              ? m.content.map((p) => ("text" in p ? String(p.text) : "")).join("")
              : String(m.content),
          )
          .join("\n");

        const n = counters[agent] ?? 0;
        counters[agent] = n + 1;
        const entry = script[agent];
        const reply: FakeReply = Array.isArray(entry)
          ? (entry[Math.min(n, entry.length - 1)] as FakeReply)
          : (entry ?? MOCK_OUTPUTS[agent]);

        if ("hang" in reply) await waitOrAbort(60_000, abortSignal);
        else await waitOrAbort(delayMs, abortSignal);
        calls.push({ agent, system, prompt: user, start, end: Date.now() });
        if ("error" in reply) throw reply.error;
        const text = "raw" in reply ? reply.raw : JSON.stringify(reply);
        return {
          content: [{ type: "text", text }],
          finishReason: { unified: "stop", raw: "end_turn" },
          usage: {
            inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 200, text: 200, reasoning: undefined },
          },
          warnings: [],
        };
      },
    });

  const models = Object.fromEntries(
    AGENT_ORDER.map((agent) => [
      agent,
      { id: "claude-haiku-4-5" as const, model: modelFor(agent) },
    ]),
  ) as unknown as AgentModels;
  return { models, calls };
}
