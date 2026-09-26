import { type AnalysisEvent, analysisEvent } from "@/schemas/events";

/** Serialises one event in text/event-stream format. */
export function encodeEvent(event: AnalysisEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Parses an SSE response body (from fetch, since EventSource can't POST) into
 * validated events. Malformed or unknown events are skipped, not thrown.
 */
export async function* readEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AnalysisEvent, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        try {
          const parsed = analysisEvent.safeParse(JSON.parse(data));
          if (parsed.success) yield parsed.data;
        } catch {
          // Skip malformed events.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
