// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import {
  editorQuickAskAiAction,
  editorRewriteAiAction,
} from "@/api/lib/ai/editor-actions";
import { MemoryAiLedger } from "@/api/lib/ai/memory-ledger";
import { collectAiActions } from "@/api/lib/ai/registry";
import { AIModel } from "@/api/models/ai";

import { estimateAiRoute, streamAiRoute } from "./stream.route";

const USER_ID = 5;

const streamingModel = (chunks: string[]) =>
  new MockLanguageModelV4({
    doStream: async () =>
      Promise.resolve({
        stream: convertArrayToReadableStream([
          { id: "t", type: "text-start" as const },
          ...chunks.map(delta => ({
            delta,
            id: "t",
            type: "text-delta" as const,
          })),
          { id: "t", type: "text-end" as const },
          {
            finishReason: { raw: "stop", unified: "stop" as const },
            type: "finish" as const,
            usage: {
              inputTokens: {
                cacheRead: 0,
                cacheWrite: 0,
                noCache: 10,
                total: 10,
              },
              outputTokens: { reasoning: 0, text: 5, total: 5 },
            },
          },
        ]),
      }),
  });

const createApp = (
  model: MockLanguageModelV4,
  ledger = new MemoryAiLedger(),
) => {
  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("user", { id: USER_ID } as never);
    c.set("admin", null);
    c.set(
      "core" as never,
      {
        ai: {
          models: [
            {
              capabilities: ["text", "streaming"],
              id: "default",
              model,
              name: "Test",
              pricing: {
                rates: { inputPerMillion: "1000", outputPerMillion: "2000" },
              },
            },
          ],
        },
        aiActions: collectAiActions([
          {
            aiActions: [editorRewriteAiAction, editorQuickAskAiAction],
            pluginId: "@vitnode/core",
          },
        ]),
      } as never,
    );
    c.set("ai", new AIModel(c as unknown as Context, { ledger }));
    await next();
  });
  app.openapi(streamAiRoute.route, streamAiRoute.handler as never);
  app.openapi(estimateAiRoute.route, estimateAiRoute.handler as never);

  return { app, ledger };
};

const rewrite = {
  action: "@vitnode/core:editor.selection.rewrite",
  input: {
    after: "",
    before: "",
    locale: "en",
    operation: "shorten",
    selection: "This is a rather long sentence that could be shorter.",
  },
};

const post = async (app: OpenAPIHono, path: string, body: unknown) =>
  await app.request(path, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

describe("POST /stream", () => {
  it("streams NDJSON deltas and ends with the run summary", async () => {
    const { app, ledger } = createApp(
      streamingModel(["A shorter", " sentence."]),
    );

    const response = await post(app, "/stream", rewrite);
    const lines = (await response.text())
      .trim()
      .split("\n")
      .map(line => JSON.parse(line) as Record<string, unknown>);

    expect(response.headers.get("content-type")).toContain(
      "application/x-ndjson",
    );
    expect(lines).toEqual([
      { t: "A shorter" },
      { t: " sentence." },
      {
        done: {
          chargedPoints: "20",
          costKnown: true,
          modelId: "default",
          runId: 1,
        },
      },
    ]);
    expect(ledger.spentPoints(USER_ID)).toBe(20_000_000_000_000n);
  });

  it("cancels the provider call and charges nothing when the client goes away", async () => {
    const { app, ledger } = createApp(
      streamingModel(["One", " two", " three", " four"]),
    );

    const response = await post(app, "/stream", rewrite);
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.cancel("closed the panel");

    await expect.poll(() => ledger.runs[0]?.status).toBe("canceled");
    expect(ledger.spentPoints(USER_ID)).toBe(0n);
  });

  it("refuses before streaming when the editor permission is not granted", async () => {
    const { app } = createApp(
      streamingModel(["x"]),
      new MemoryAiLedger({
        policy: () => ({
          dailyLimit: null,
          granted: false,
          monthlyPoints: null,
        }),
      }),
    );

    const response = await post(app, "/stream", rewrite);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "AI_UNAUTHORIZED" });
  });
});

describe("POST /estimate", () => {
  it("answers an upper bound before anything runs", async () => {
    const model = streamingModel(["x"]);
    const { app, ledger } = createApp(model);

    const response = await post(app, "/estimate", rewrite);
    const estimate = (await response.json()) as { maxPoints: string };

    expect(Number(estimate.maxPoints)).toBeGreaterThan(20);
    expect(ledger.runs).toHaveLength(0);
    expect(model.doStreamCalls).toHaveLength(0);
  });
});
