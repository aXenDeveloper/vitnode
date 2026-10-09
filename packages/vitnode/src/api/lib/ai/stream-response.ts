import type { Context } from "hono";

import type { AiRunRequest } from "./runner";

import { isAiError } from "./errors";

export const AI_NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
} as const;

export const aiNdjsonStream = async (
  c: Context,
  request: Omit<AiRunRequest, "signal">,
): Promise<ReadableStream<Uint8Array>> => {
  const { result, textStream } = await c
    .get("ai")
    .stream({ ...request, signal: c.req.raw.signal });
  const encoder = new TextEncoder();
  const line = (value: unknown) => encoder.encode(`${JSON.stringify(value)}\n`);
  const reader = textStream.getReader();

  return new ReadableStream<Uint8Array>({
    cancel: async reason => {
      await reader.cancel(reason);
    },
    pull: async controller => {
      try {
        const { done, value } = await reader.read();
        if (!done) {
          controller.enqueue(line({ t: value }));

          return;
        }
        const { runId, usage } = await result;
        controller.enqueue(line({ done: { runId, ...usage } }));
        controller.close();
      } catch (error) {
        controller.enqueue(
          line({
            e: isAiError(error)
              ? { code: error.code, message: error.message }
              : {
                  code: "AI_PROVIDER_FAILED",
                  message: "The AI request failed.",
                },
          }),
        );
        controller.close();
      }
    },
  });
};
