import { MAX_REQUEST_BYTES } from "@/ingest/limits";

/**
 * Same-origin check for state-changing requests: the browser's Origin header
 * must match the host the request was sent to. Stops other sites from spending
 * this app's API budget through visitors' browsers.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Rejects oversized bodies from the Content-Length header, before reading them. */
export function isBodyTooLarge(request: Request): boolean {
  const length = Number(request.headers.get("content-length"));
  return Number.isFinite(length) && length > MAX_REQUEST_BYTES;
}

/** JSON error body for non-streaming failures. `resetAt` (ISO) accompanies 429s. */
export type ApiError = { error: { code: string; message: string; resetAt?: string } };

export function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } } satisfies ApiError, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
