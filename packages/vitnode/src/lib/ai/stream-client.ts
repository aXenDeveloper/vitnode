import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";

import {
  AI_CLIENT_ERROR_CODES,
  type AiClientErrorCode,
  AiRequestError,
  readAiErrorCode,
} from "./assist-client";

/** Which session an AI request runs under: the AdminCP's, or the member's. */
export type AiAssistScope = "admin" | "user";

/** AdminCP pages live under `/admin`; everything else is the public site. */
export const aiAssistScope = (): AiAssistScope =>
  typeof window !== "undefined" &&
  /^\/admin(\/|$)/.test(window.location.pathname)
    ? "admin"
    : "user";

const codeOf = (value: unknown): AiClientErrorCode =>
  typeof value === "string" &&
  (AI_CLIENT_ERROR_CODES as readonly string[]).includes(value)
    ? (value as AiClientErrorCode)
    : "unknown";

export interface AiStreamSummary {
  chargedPoints: string;
  costKnown: boolean;
  runId: number;
}

/**
 * Streams a text action. `onDelta` receives each piece as it arrives; the
 * promise resolves with the run summary or rejects with an `AiRequestError`.
 * Aborting `signal` cancels the provider call - the user is not charged.
 */
export const streamAiAction = async ({
  action,
  input,
  onDelta,
  scope,
  signal,
}: {
  action: string;
  input: unknown;
  onDelta: (delta: string) => void;
  scope: AiAssistScope;
  signal?: AbortSignal;
}): Promise<AiStreamSummary> => {
  const body = { action, idempotencyKey: crypto.randomUUID(), input };
  const response =
    scope === "admin"
      ? await fetcherClient({
          plugin: CONFIG_PLUGIN.pluginId,
          args: { body },
          method: "post",
          module: "admin/ai",
          options: { credentials: "include", signal },
          path: "/assist/stream",
        })
      : await fetcherClient({
          plugin: CONFIG_PLUGIN.pluginId,
          args: { body },
          method: "post",
          module: "ai",
          options: { credentials: "include", signal },
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
      if (event.e) throw new AiRequestError(codeOf(event.e.code), 200);
      if (event.done) return event.done;
    }
  }

  throw new AiRequestError("AI_PROVIDER_FAILED", 200);
};

/** The most one request could cost, in points - a bound, never a price. */
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
          plugin: CONFIG_PLUGIN.pluginId,
          args: { body },
          method: "post",
          module: "admin/ai",
          options: { credentials: "include" },
          path: "/assist/estimate",
        })
      : await fetcherClient({
          plugin: CONFIG_PLUGIN.pluginId,
          args: { body },
          method: "post",
          module: "ai",
          options: { credentials: "include" },
          path: "/estimate",
        });
  if (!response.ok) return null;

  return (await response.json()).maxPoints;
};
