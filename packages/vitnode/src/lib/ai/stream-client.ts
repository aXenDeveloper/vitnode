import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";

import {
  AiRequestError,
  readAiErrorCode,
  toAiClientErrorCode,
} from "./assist-client";

export type AiAssistScope = "admin" | "user";

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
          options: { signal },
          path: "/assist/stream",
        })
      : await fetcherClient({
          plugin: CONFIG_PLUGIN.pluginId,
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
          plugin: CONFIG_PLUGIN.pluginId,
          args: { body },
          method: "post",
          module: "admin/ai",
          path: "/assist/estimate",
        })
      : await fetcherClient({
          plugin: CONFIG_PLUGIN.pluginId,
          args: { body },
          method: "post",
          module: "ai",
          path: "/estimate",
        });
  if (!response.ok) return null;

  return (await response.json()).maxPoints;
};
