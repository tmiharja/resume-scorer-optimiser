import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

// API-level checks against the production build (LLM_MOCK=1). The upload UI
// and its rejection messages get browser e2e tests in Phase 4.
test.describe("POST /api/analyze", () => {
  test.skip(({ isMobile }) => isMobile, "API behaviour doesn't depend on the device");

  const fixture = (name: string) => readFile(path.join("evals/fixtures", name));

  test("streams progress and a result, flagging hidden text (mocked LLM)", async ({
    request,
    baseURL,
  }) => {
    const res = await request.post("/api/analyze", {
      headers: { origin: baseURL! },
      multipart: {
        file: {
          name: "resume.pdf",
          mimeType: "application/pdf",
          buffer: await fixture("hidden-injection.pdf"),
        },
      },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/event-stream");
    const events = (await res.text())
      .split("\n\n")
      .map((block) => block.split("\n").find((l) => l.startsWith("data: ")))
      .filter(Boolean)
      .map((line) => JSON.parse(line!.slice(6)));
    expect(events[0]).toMatchObject({ type: "step", step: "parse", status: "done" });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "warning",
        warning: expect.objectContaining({ kind: "hidden_white_text" }),
      }),
    );
    const last = events.at(-1);
    expect(last.type).toBe("result");
    expect(last.result.dimensions).toHaveLength(5);
  });

  test("rejects a non-PDF", async ({ request, baseURL }) => {
    const res = await request.post("/api/analyze", {
      headers: { origin: baseURL! },
      multipart: {
        file: {
          name: "resume.docx",
          mimeType: "application/pdf",
          buffer: Buffer.from("PK\u0003\u0004"),
        },
      },
    });
    expect(res.status()).toBe(415);
    expect((await res.json()).error.message).toContain(".docx");
  });

  test("rejects an oversize upload", async ({ request, baseURL }) => {
    const big = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(4 * 1024 * 1024 + 10)]);
    const res = await request.post("/api/analyze", {
      headers: { origin: baseURL! },
      multipart: { file: { name: "big.pdf", mimeType: "application/pdf", buffer: big } },
    });
    expect(res.status()).toBe(413);
  });

  test("rejects cross-site requests", async ({ request }) => {
    const res = await request.post("/api/analyze", {
      headers: { origin: "https://evil.example" },
      multipart: { jd: "x" },
    });
    expect(res.status()).toBe(403);
  });
});
