import {
  APICallError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  RetryError,
  generateText,
} from "ai";
import type { z } from "zod";
import type { Agent, AgentModel } from "@/llm/models";
import { type ModelId, type TokenUsage, costUsd } from "@/llm/pricing";
import { SECURITY_PREAMBLE } from "@/prompts/shared";

export type AgentErrorCode = "timeout" | "cancelled" | "schema" | "api";

/** Failure of one agent step. The message never contains resume content. */
export class AgentError extends Error {
  readonly agent: Agent;
  readonly code: AgentErrorCode;
  readonly usage: TokenUsage;
  /** Loggable reason (see failureDetail); never contains resume content. */
  readonly detail: string | undefined;

  constructor(
    agent: Agent,
    code: AgentErrorCode,
    usage: TokenUsage,
    cause?: unknown,
    detail?: string,
  ) {
    super(`${agent} failed: ${code}`, { cause });
    this.name = "AgentError";
    this.agent = agent;
    this.code = code;
    this.usage = usage;
    this.detail = detail;
  }
}

/**
 * A short, loggable reason for an API failure: the HTTP status plus the error
 * type and message from Anthropic's error body (e.g. "400 invalid_request_error:
 * Your credit balance is too low…"). Those messages describe the request's
 * problem, not its content; the message is still cut short, and nothing else
 * from the request or response is kept.
 */
export function failureDetail(error: unknown): string | undefined {
  const last = RetryError.isInstance(error) ? error.lastError : error;
  if (!APICallError.isInstance(last)) return undefined;
  let type = "";
  let message = "";
  try {
    const body = JSON.parse(last.responseBody ?? "") as {
      error?: { type?: unknown; message?: unknown };
    };
    if (typeof body.error?.type === "string") type = body.error.type;
    if (typeof body.error?.message === "string") message = body.error.message;
  } catch {
    // Not a JSON error body (e.g. a gateway page): the status alone will do.
  }
  const status = last.statusCode ?? "network";
  return [`${status}${type ? ` ${type}` : ""}`, message.slice(0, 160)].filter(Boolean).join(": ");
}

export type AgentRun<T> = {
  output: T;
  usage: TokenUsage;
  costUsd: number;
  modelId: ModelId;
  attempts: number;
  durationMs: number;
};

export type RunAgentOptions<S extends z.ZodType> = {
  agent: Agent;
  model: AgentModel;
  /** Static, agent-specific system prompt (cached). */
  instructions: string;
  /** Per-request user content, with untrusted parts already wrapped. */
  prompt: string;
  schema: S;
  timeoutMs: number;
  maxOutputTokens: number;
  /** Pipeline-wide cancellation (client disconnect, global deadline). */
  signal?: AbortSignal;
};

const ZERO: TokenUsage = {
  inputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
  outputTokens: 0,
};

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}

type SdkUsage = {
  inputTokens?: number | undefined;
  inputTokenDetails?: {
    noCacheTokens?: number | undefined;
    cacheReadTokens?: number | undefined;
    cacheWriteTokens?: number | undefined;
  };
  outputTokens?: number | undefined;
};

function toUsage(u: SdkUsage | undefined): TokenUsage {
  if (!u) return ZERO;
  const cacheRead = u.inputTokenDetails?.cacheReadTokens ?? 0;
  const cacheWrite = u.inputTokenDetails?.cacheWriteTokens ?? 0;
  const noCache =
    u.inputTokenDetails?.noCacheTokens ??
    Math.max(0, (u.inputTokens ?? 0) - cacheRead - cacheWrite);
  return {
    inputTokens: noCache,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    outputTokens: u.outputTokens ?? 0,
  };
}

const REPAIR_NOTE =
  "\n\nYour previous reply did not match the required JSON schema. Reply again with a single JSON object that matches the schema exactly.";

/**
 * Runs one agent step: a structured-output call with the shared security
 * preamble, a prompt-cache breakpoint on the static system prompt, SDK-level
 * retries for rate limits / 5xx (maxRetries), one schema-repair retry, and a
 * per-step timeout. Token usage is summed across attempts, including failed ones.
 */
export async function runAgent<S extends z.ZodType>(
  opts: RunAgentOptions<S>,
): Promise<AgentRun<z.output<S>>> {
  const started = Date.now();
  let usage = ZERO;
  let attempts = 0;

  for (const repair of [false, true]) {
    attempts++;
    const deadline = AbortSignal.timeout(opts.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, deadline]) : deadline;
    try {
      const result = await generateText({
        model: opts.model.model,
        instructions: [
          {
            role: "system",
            content: `${SECURITY_PREAMBLE}\n\n${opts.instructions}`,
            // Cache breakpoint on the static prefix. Below a model's minimum
            // (4096 tokens on Haiku 4.5) this is a no-op at no extra cost.
            providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
          },
        ],
        prompt: repair ? opts.prompt + REPAIR_NOTE : opts.prompt,
        output: Output.object({ schema: opts.schema }),
        maxOutputTokens: opts.maxOutputTokens,
        maxRetries: 2,
        abortSignal: signal,
        ...(opts.model.providerOptions ? { providerOptions: opts.model.providerOptions } : {}),
      });
      usage = addUsage(usage, toUsage(result.usage));
      const output = result.output as z.output<S>;
      return {
        output,
        usage,
        costUsd: costUsd(opts.model.id, usage),
        modelId: opts.model.id,
        attempts,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        usage = addUsage(usage, toUsage(error.usage));
        if (error.finishReason === "length") {
          // Cut off at the output cap: a repair attempt would hit the same cap.
          throw new AgentError(
            opts.agent,
            "schema",
            usage,
            error,
            `output reached the ${opts.maxOutputTokens}-token limit`,
          );
        }
        if (!repair) continue; // one schema-repair retry
        throw new AgentError(opts.agent, "schema", usage, error, "output did not match the schema");
      }
      if (NoOutputGeneratedError.isInstance(error)) {
        if (!repair) continue;
        throw new AgentError(opts.agent, "schema", usage, error, "no output");
      }
      if (opts.signal?.aborted) throw new AgentError(opts.agent, "cancelled", usage, error);
      if (deadline.aborted) {
        throw new AgentError(
          opts.agent,
          "timeout",
          usage,
          error,
          `no reply within ${opts.timeoutMs} ms`,
        );
      }
      throw new AgentError(opts.agent, "api", usage, error, failureDetail(error));
    }
  }
  // Unreachable: the loop either returns or throws.
  throw new AgentError(opts.agent, "schema", usage);
}
