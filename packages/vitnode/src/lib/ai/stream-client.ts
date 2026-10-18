import { fetcherClient } from "@/lib/fetcher-client";
import { manifest } from "@/manifest";

import {
  AiRequestError,
  readAiErrorCode,
  toAiClientErrorCode,
} from "./assist-client";

/** Which AI routes a browser call uses: the AdminCP's (`admin`) or the public ones (`user`). */
export type AiAssistScope = "admin" | "user";

/** `admin` on a page under `/admin`, `user` elsewhere and on the server. */
export const aiAssistScope = (): AiAssistScope =>
  typeof window !== "undefined" &&
  /^\/admin(\/|$)/.test(window.location.pathname)
    ? "admin"
    : "user";

export interface AiStreamSummary {
  chargedPoints: string;
  costKnown: boolean;
  runId: number;
}

/**
 * Runs an AI action and streams its text output, calling `onDelta` with each
 * chunk as it arrives. Resolves with the run's summary when the stream ends.
 * Browser-only; text actions only. Each call sends a fresh idempotency key.
 *
 * @throws `AiRequestError` for a non-2xx response or missing body, for an
 * error event inside the stream (with status `200`), and with
 * `AI_PROVIDER_FAILED` when the stream ends without a summary.
 */
export const streamAiAction = async ({
  action,
  input,
  onDelta,
  scope,
  signal,
}: {
  /** The qualified action key, e.g. `"@vitnode/blog:excerpt.generate"`. */
  action: string;
  /** The action's input; validated on the server. */
  input: unknown;
  /** Called with each new chunk of text, in order. */
  onDelta: (delta: string) => void;
  /** Which routes to call; {@link aiAssistScope} picks it from the current page. */
  scope: AiAssistScope;
  /** Aborts the request and the stream. */
  signal?: AbortSignal;
}): Promise<AiStreamSummary> => {
  const body = { action, idempotencyKey: crypto.randomUUID(), input };
  const response =
    scope === "admin"
      ? await fetcherClient({
          plugin: manifest.id,
          args: { body },
          method: "post",
          module: "admin/ai",
          options: { signal },
          path: "/assist/stream",
        })
      : await fetcherClient({
          plugin: manifest.id,
          args: { body },
          method: "post",
          module: "ai",
          options: { signal },
          path: "/stream",
        });
  if (!response.ok || !response.body) {
    throw new AiRequestError(await readAiErrorCode(response), response.status);
  }

  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as {
        done?: AiStreamSummary;
        e?: { code?: unknown };
        t?: string;
      };
      if (typeof event.t === "string") onDelta(event.t);
      if (event.e)
        throw new AiRequestError(toAiClientErrorCode(event.e.code), 200);
      if (event.done) return event.done;
    }
  }

  throw new AiRequestError("AI_PROVIDER_FAILED", 200);
};

export const estimateAiAction = async ({
  action,
  input,
  scope,
}: {
  action: string;
  input: unknown;
  scope: AiAssistScope;
}): Promise<null | string> => {
  const body = { action, input };
  const response =
    scope === "admin"
      ? await fetcherClient({
          plugin: manifest.id,
          args: { body },
          method: "post",
          module: "admin/ai",
          path: "/assist/estimate",
        })
      : await fetcherClient({
          plugin: manifest.id,
          args: { body },
          method: "post",
          module: "ai",
          path: "/estimate",
        });
  if (!response.ok) return null;

  return (await response.json()).maxPoints;
};
