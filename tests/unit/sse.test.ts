import { describe, expect, it } from "vitest";
import { encodeEvent, readEvents } from "@/lib/sse";
import type { AnalysisEvent } from "@/schemas/events";

function streamOf(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

describe("SSE", () => {
  it("round-trips events, even when chunks split mid-event", async () => {
    const events: AnalysisEvent[] = [
      { type: "step", step: "extract", status: "started", t: 10 },
      { type: "error", code: "timeout", message: "Took too long" },
    ];
    const wire = events.map(encodeEvent).join("");
    const chunks = [wire.slice(0, 7), wire.slice(7, 40), wire.slice(40)];
    const out: AnalysisEvent[] = [];
    for await (const e of readEvents(streamOf(chunks))) out.push(e);
    expect(out).toEqual(events);
  });

  it("skips malformed and unknown events", async () => {
    const out: AnalysisEvent[] = [];
    const wire = `data: {not json}\n\ndata: {"type":"nope"}\n\n${encodeEvent({ type: "step", step: "parse", status: "done", t: 1 })}`;
    for await (const e of readEvents(streamOf([wire]))) out.push(e);
    expect(out).toHaveLength(1);
  });
});
