import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/analyze/route";
import { getEnv } from "@/env";
import { readEvents } from "@/lib/sse";
import { capacityMessage, memoryBudget, monthKey, nextMonthStart } from "@/server/budget";
import { getGuards, resetGuardsForTests } from "@/server/guards";
import { WINDOW_MS, clientIp, hashIp, memoryLimiter } from "@/server/ratelimit";
import { SAMPLE_RESUME, buildResumePdf } from "../fixtures/pdf-builder";

describe("IP hashing", () => {
  it("is stable per IP and salt, and never contains the IP", () => {
    const a = hashIp("203.0.113.7", "salt-one-salt-one-salt-one-salt-one");
    expect(a).toBe(hashIp("203.0.113.7", "salt-one-salt-one-salt-one-salt-one"));
    expect(a).not.toBe(hashIp("203.0.113.7", "salt-two-salt-two-salt-two-salt-two"));
    expect(a).not.toBe(hashIp("203.0.113.8", "salt-one-salt-one-salt-one-salt-one"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("203.0.113.7");
  });

  it("reads the client IP from the first x-forwarded-for entry", () => {
    const req = (headers: Record<string, string>) => new Request("http://x", { headers });
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("memory sliding window", () => {
  it("allows N per 24 hours, then resets as old hits age out", async () => {
    let now = 1_000_000;
    const limiter = memoryLimiter(2, () => now);
    expect((await limiter.limit("k")).success).toBe(true);
    now += 1000;
    const second = await limiter.limit("k");
    expect(second).toMatchObject({ success: true, remaining: 0 });
    const third = await limiter.limit("k");
    expect(third.success).toBe(false);
    expect(third.reset).toBe(1_000_000 + WINDOW_MS);
    expect((await limiter.limit("other")).success).toBe(true);
    now = 1_000_000 + WINDOW_MS + 1;
    expect((await limiter.limit("k")).success).toBe(true);
  });
});

describe("monthly budget", () => {
  it("sums spend per month", async () => {
    const budget = memoryBudget();
    await budget.add("2026-09", 0.05);
    await budget.add("2026-09", 0.04);
    await budget.add("2026-10", 1);
    await budget.add("2026-09", -5);
    expect(await budget.spent("2026-09")).toBeCloseTo(0.09);
  });

  it("knows when the next month starts", () => {
    expect(monthKey(new Date("2026-09-30T23:00:00Z"))).toBe("2026-09");
    expect(nextMonthStart(new Date("2026-12-15T00:00:00Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
    expect(capacityMessage(new Date("2026-09-26T00:00:00Z"))).toContain("1 October");
  });
});

describe("POST /api/analyze guards", () => {
  afterEach(() => resetGuardsForTests());

  const post = async (ip: string) => {
    const pdf = await buildResumePdf({ blocks: SAMPLE_RESUME });
    const form = new FormData();
    form.set("file", new Blob([pdf]), "resume.pdf");
    return POST(
      new Request("http://localhost:3000/api/analyze", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000", "x-forwarded-for": ip },
        body: form,
      }),
    );
  };
  const drain = async (res: Response) => {
    for await (const _ of readEvents(res.body!)) void _;
  };

  it("allows 5 analyses per visitor per day, then returns 429 with a reset time", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await post("203.0.113.10");
      expect(res.status).toBe(200);
      await drain(res);
    }
    const limited = await post("203.0.113.10");
    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.message).toContain("5 free analyses");
    expect(Date.parse(body.error.resetAt)).toBeGreaterThan(Date.now());
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another visitor is unaffected.
    expect((await post("203.0.113.11")).status).toBe(200);
  });

  it("doesn't use quota for rejected uploads", async () => {
    const bad = new FormData();
    bad.set("file", new Blob(["PK\u0003\u0004"]), "resume.docx");
    for (let i = 0; i < 8; i++) {
      const res = await POST(
        new Request("http://localhost:3000/api/analyze", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            host: "localhost:3000",
            "x-forwarded-for": "203.0.113.20",
          },
          body: bad,
        }),
      );
      expect(res.status).toBe(415);
    }
    expect((await post("203.0.113.20")).status).toBe(200);
  });

  it("returns 503 once the monthly budget is spent", async () => {
    const env = getEnv();
    await getGuards(env).budget.add(monthKey(), env.MONTHLY_BUDGET_USD);
    const res = await post("203.0.113.30");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("capacity_reached");
    expect(body.error.message).toMatch(/back on 1 \w+/);
  });

  it("adds each run's cost to the monthly budget", async () => {
    const env = getEnv();
    const res = await post("203.0.113.40");
    await drain(res);
    // after() falls back to running immediately outside Next.js; let it settle.
    await new Promise((r) => setTimeout(r, 20));
    expect(await getGuards(env).budget.spent(monthKey())).toBeGreaterThan(0);
  });
});
