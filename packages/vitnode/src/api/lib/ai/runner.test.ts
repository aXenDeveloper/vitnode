// @vitest-environment node
import type { Context } from "hono";

import { APICallError } from "ai";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { AIModelDefinition } from "../../models/ai";
import type { AiPricing } from "./pricing";

import { defineAiAction } from "./action";
import { parseDecimal } from "./decimal";
import { AiError } from "./errors";
import { MemoryAiLedger } from "./memory-ledger";
import { collectAiActions } from "./registry";
import { AiRunner } from "./runner";

type LanguageModelV4GenerateResult = Awaited<
  ReturnType<MockLanguageModelV4["doGenerate"]>
>;

const PRICING: AiPricing = {
  rates: { inputPerMillion: "1000", outputPerMillion: "2000" },
};

const generated = (
  text: string,
  usage = { input: 10, output: 5 },
): LanguageModelV4GenerateResult => ({
  content: [{ text, type: "text" }],
  finishReason: { raw: "stop", unified: "stop" },
  usage: {
    inputTokens: {
      cacheRead: 0,
      cacheWrite: 0,
      noCache: usage.input,
      total: usage.input,
    },
    outputTokens: { reasoning: 0, text: usage.output, total: usage.output },
  },
  warnings: [],
});

const answering = (...texts: string[]) =>
  new MockLanguageModelV4({ doGenerate: texts.map(text => generated(text)) });

const failingThen = (texts: string[], failures: number) => {
  let calls = 0;

  return new MockLanguageModelV4({
    doGenerate: async () => {
      calls += 1;
      if (calls <= failures) {
        throw new APICallError({
          isRetryable: true,
          message: "overloaded",
          requestBodyValues: {},
          statusCode: 529,
          url: "https://provider.test",
        });
      }

      return Promise.resolve(generated(texts[calls - failures - 1] ?? "ok"));
    },
  });
};

const summarize = defineAiAction({
  authorize: ({ input }) => input.text !== "forbidden",
  buildPrompt: input => ({ prompt: input.text, system: "Summarize." }),
  defaults: {
    maxInputCharacters: 1_000,
    maxOutputTokens: 100,
    timeoutMs: 10_000,
  },
  id: "summary.generate",
  inputSchema: z.object({ text: z.string().min(1) }),
  output: "text",
  outputSchema: z.string().min(1),
  parseText: text => text.trim(),
  permission: "summary",
  promptVersion: 1,
  requiredCapabilities: ["text"],
});

const describeImage = defineAiAction({
  actors: ["system"],
  buildPrompt: input => ({
    messages: [
      {
        content: [
          { text: "Describe the image.", type: "text" },
          { data: input.image, mediaType: "image/png", type: "file" },
        ],
        role: "user",
      },
    ],
  }),
  defaults: { maxInputCharacters: 10, maxOutputTokens: 100, timeoutMs: 10_000 },
  id: "media.alt.generate",
  inputSchema: z.object({ image: z.instanceof(Uint8Array) }),
  measureInput: () => 0,
  output: "text",
  outputSchema: z.string().min(1),
  parseText: text => text.trim(),
  permission: "media.alt",
  promptVersion: 1,
  requiredCapabilities: ["text", "image-input"],
});

const registry = collectAiActions([
  { aiActions: [summarize], pluginId: "@acme/notes" },
  { aiActions: [describeImage], pluginId: "@vitnode/core" },
]);

const SUMMARY = "@acme/notes:summary.generate";
const ALT = "@vitnode/core:media.alt.generate";

const context = (userId: null | number = 7) =>
  ({
    get: (key: string) => {
      if (key === "user") return userId === null ? null : { id: userId };
      if (key === "admin") return null;

      return undefined;
    },
  }) as unknown as Context;

const setup = ({
  ledger = new MemoryAiLedger(),
  models,
  userId,
}: {
  ledger?: MemoryAiLedger;
  models: AIModelDefinition[];
  userId?: null | number;
}) => ({
  ledger,
  runner: new AiRunner({
    adapters: [],
    c: context(userId),
    ledger,
    models,
    registry,
  }),
});

const textModel = (
  model: MockLanguageModelV4,
  overrides: Partial<AIModelDefinition> = {},
): AIModelDefinition => ({
  id: "default",
  model,
  name: "Test",
  pricing: PRICING,
  ...overrides,
});

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AiError) return error.code;
    throw error;
  }

  return "resolved";
};

describe("AiRunner.run", () => {
  it("delivers a validated result and charges points for its cost", async () => {
    const { ledger, runner } = setup({
      models: [textModel(answering("  A short summary.  "))],
    });

    const result = await runner.run({
      action: SUMMARY,
      input: { text: "Long" },
    });

    expect(result.output).toBe("A short summary.");
    // 10 input * $1000/1M + 5 output * $2000/1M = $0.02 = 20 points.
    expect(result.usage).toEqual({
      chargedPoints: "20",
      costKnown: true,
      modelId: "default",
    });
    expect(ledger.spentPoints(7)).toBe(parseDecimal("20"));
    expect(ledger.calls).toHaveLength(1);
    expect(ledger.calls[0].finish?.usage).toMatchObject({
      inputTokens: 10,
      outputTokens: 5,
    });
  });

  it("charges the user nothing when the provider fails, and records each call", async () => {
    const model = failingThen([], 5);
    const { ledger, runner } = setup({ models: [textModel(model)] });

    expect(
      await codeOf(runner.run({ action: SUMMARY, input: { text: "x" } })),
    ).toBe("AI_PROVIDER_FAILED");
    expect(ledger.spentPoints(7)).toBe(0n);
    expect(ledger.runs[0]).toMatchObject({ settled: true, status: "failed" });
  });

  it("retries, then sums every billable call once", async () => {
    const model = failingThen(["Done."], 1);
    const ledger = new MemoryAiLedger({
      actionSettings: { [SUMMARY]: { maxRetries: 1 } },
    });
    const { runner } = setup({ ledger, models: [textModel(model)] });

    const result = await runner.run({ action: SUMMARY, input: { text: "x" } });

    expect(result.output).toBe("Done.");
    expect(ledger.calls).toHaveLength(2);
    expect(ledger.calls[0].finish?.status).toBe("failed");
    expect(result.usage.chargedPoints).toBe("20");
  });

  it("charges the user only for the call that delivered, never for a lost attempt", async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls += 1;
        if (calls === 1) throw new TypeError("socket hang up");

        return Promise.resolve(generated("Done."));
      },
    });
    const ledger = new MemoryAiLedger({
      actionSettings: { [SUMMARY]: { maxRetries: 1 } },
    });
    const { runner } = setup({ ledger, models: [textModel(model)] });

    const result = await runner.run({ action: SUMMARY, input: { text: "x" } });

    // The lost attempt's cost is unknown: the site pays the whole hold,
    // the user pays only the 20 points of the answer they got.
    expect(result.usage).toMatchObject({
      chargedPoints: "20",
      costKnown: false,
    });
    expect(ledger.spentUsd()).toBe(ledger.runs[0].reservedUsd);
  });

  it("falls back to a compatible model after the primary fails", async () => {
    const ledger = new MemoryAiLedger({
      actionSettings: {
        [SUMMARY]: { fallbackModelId: "backup", modelId: "default" },
      },
    });
    const { runner } = setup({
      ledger,
      models: [
        textModel(failingThen([], 9)),
        textModel(answering("From backup."), { id: "backup" }),
      ],
    });

    const result = await runner.run({ action: SUMMARY, input: { text: "x" } });

    expect(result).toMatchObject({
      output: "From backup.",
      usage: { modelId: "backup" },
    });
  });

  it("refuses empty output without charging the user, while the site pays", async () => {
    const { ledger, runner } = setup({ models: [textModel(answering("   "))] });

    expect(
      await codeOf(runner.run({ action: SUMMARY, input: { text: "x" } })),
    ).toBe("AI_INVALID_OUTPUT");
    expect(ledger.spentPoints(7)).toBe(0n);
    expect(ledger.spentUsd()).toBe(parseDecimal("0.02"));
  });

  it("records an unpriced cost as unknown, never as zero", async () => {
    const ledger = new MemoryAiLedger({
      policy: () => ({ dailyLimit: null, granted: true, monthlyPoints: null }),
    });
    const { runner } = setup({
      ledger,
      models: [textModel(answering("Hi."), { pricing: undefined })],
    });

    const result = await runner.run({ action: SUMMARY, input: { text: "x" } });

    expect(result.usage.costKnown).toBe(false);
    expect(ledger.calls[0].finish?.cost).toEqual({
      amountUsd: null,
      reason: "no pricing",
      source: "unknown",
    });
    const global = [...ledger.budgets.values()].find(
      row => row.scopeKey === "global",
    );
    expect(global?.unknownCount).toBe(1);
  });

  it("refuses an unpriced model before any call when a cap applies", async () => {
    const model = answering("Hi.");
    const ledger = new MemoryAiLedger({
      policy: () => ({
        dailyLimit: null,
        granted: true,
        monthlyPoints: parseDecimal("100"),
      }),
    });
    const { runner } = setup({
      ledger,
      models: [textModel(model, { pricing: undefined })],
    });

    expect(
      await codeOf(runner.run({ action: SUMMARY, input: { text: "x" } })),
    ).toBe("AI_PRICING_MISSING");
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("stops at the user's monthly points with a reset date", async () => {
    const model = answering("Hi.");
    const ledger = new MemoryAiLedger({
      policy: () => ({
        dailyLimit: null,
        granted: true,
        monthlyPoints: parseDecimal("1"),
      }),
    });
    const { runner } = setup({ ledger, models: [textModel(model)] });

    const error = await runner
      .run({ action: SUMMARY, input: { text: "x" } })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).body).toMatchObject({
      code: "AI_USER_LIMIT_REACHED",
      resetsAt: expect.any(String),
    });
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("stops at the global budget", async () => {
    const ledger = new MemoryAiLedger({
      settings: { monthlyBudgetUsd: parseDecimal("0.0001") },
    });
    const { runner } = setup({ ledger, models: [textModel(answering("Hi."))] });

    expect(
      await codeOf(runner.run({ action: SUMMARY, input: { text: "x" } })),
    ).toBe("AI_BUDGET_EXHAUSTED");
  });

  it("enforces the daily invocation limit", async () => {
    const ledger = new MemoryAiLedger({
      policy: () => ({ dailyLimit: 1, granted: true, monthlyPoints: null }),
    });
    const { runner } = setup({
      ledger,
      models: [textModel(answering("One.", "Two."))],
    });

    await runner.run({ action: SUMMARY, input: { text: "x" } });

    expect(
      await codeOf(runner.run({ action: SUMMARY, input: { text: "y" } })),
    ).toBe("AI_DAILY_LIMIT_REACHED");
  });

  it("refuses actors without the AI permission or without access to the content", async () => {
    const denied = setup({
      ledger: new MemoryAiLedger({
        policy: () => ({
          dailyLimit: null,
          granted: false,
          monthlyPoints: null,
        }),
      }),
      models: [textModel(answering("Hi."))],
    });
    const allowed = setup({ models: [textModel(answering("Hi."))] });
    const anonymous = setup({
      models: [textModel(answering("Hi."))],
      userId: null,
    });

    expect(
      await codeOf(
        denied.runner.run({ action: SUMMARY, input: { text: "x" } }),
      ),
    ).toBe("AI_UNAUTHORIZED");
    expect(
      await codeOf(
        allowed.runner.run({ action: SUMMARY, input: { text: "forbidden" } }),
      ),
    ).toBe("AI_UNAUTHORIZED");
    expect(
      await codeOf(
        anonymous.runner.run({ action: SUMMARY, input: { text: "x" } }),
      ),
    ).toBe("AI_UNAUTHORIZED");
  });

  it("never lets a client run a system-only action", async () => {
    const { runner } = setup({ models: [textModel(answering("Hi."))] });

    expect(
      await codeOf(
        runner.run({ action: ALT, input: { image: new Uint8Array([1]) } }),
      ),
    ).toBe("AI_UNAUTHORIZED");
  });

  it("honours the global switch and a disabled action", async () => {
    const off = setup({
      ledger: new MemoryAiLedger({ settings: { enabled: false } }),
      models: [textModel(answering("Hi."))],
    });
    const disabled = setup({
      ledger: new MemoryAiLedger({
        actionSettings: { [SUMMARY]: { enabled: false } },
      }),
      models: [textModel(answering("Hi."))],
    });

    expect(
      await codeOf(off.runner.run({ action: SUMMARY, input: { text: "x" } })),
    ).toBe("AI_DISABLED");
    expect(
      await codeOf(
        disabled.runner.run({ action: SUMMARY, input: { text: "x" } }),
      ),
    ).toBe("AI_ACTION_DISABLED");
  });

  it("validates input and bounds its size", async () => {
    const { runner } = setup({ models: [textModel(answering("Hi."))] });

    expect(
      await codeOf(runner.run({ action: SUMMARY, input: { text: "" } })),
    ).toBe("AI_INVALID_INPUT");
    expect(
      await codeOf(
        runner.run({ action: SUMMARY, input: { text: "x".repeat(1_001) } }),
      ),
    ).toBe("AI_INPUT_TOO_LARGE");
    expect(
      await codeOf(runner.run({ action: "@acme/notes:nope", input: {} })),
    ).toBe("AI_ACTION_UNKNOWN");
  });

  it("runs a duplicate submission only once", async () => {
    const model = answering("Once.", "Twice.");
    const { ledger, runner } = setup({ models: [textModel(model)] });

    await runner.run({
      action: SUMMARY,
      idempotencyKey: "abc",
      input: { text: "x" },
    });

    expect(
      await codeOf(
        runner.run({
          action: SUMMARY,
          idempotencyKey: "abc",
          input: { text: "x" },
        }),
      ),
    ).toBe("AI_DUPLICATE_REQUEST");
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(ledger.spentPoints(7)).toBe(parseDecimal("20"));
  });

  it("settles a run only once", async () => {
    const { ledger, runner } = setup({ models: [textModel(answering("Hi."))] });
    const { runId } = await runner.run({
      action: SUMMARY,
      input: { text: "x" },
    });

    const again = await ledger.settle(runId, {
      delivered: true,
      errorCode: null,
      finishedAt: new Date(),
      status: "succeeded",
    });

    expect(again.applied).toBe(false);
    expect(ledger.spentPoints(7)).toBe(parseDecimal("20"));
  });
});

describe("model capabilities", () => {
  it("never assumes vision for a model that does not declare it", async () => {
    const { runner } = setup({
      models: [textModel(answering("A cat."))],
      userId: null,
    });

    expect(
      await codeOf(
        runner.runAsSystem({
          action: ALT,
          input: { image: new Uint8Array([1]) },
        }),
      ),
    ).toBe("AI_MODEL_INCOMPATIBLE");
  });

  it("picks the first model that declares every required capability", async () => {
    const vision = answering("A cat on a sofa.");
    const { runner } = setup({
      models: [
        textModel(answering("unused")),
        textModel(vision, {
          capabilities: ["text", "image-input"],
          id: "vision",
        }),
      ],
      userId: null,
    });

    const result = await runner.runAsSystem({
      action: ALT,
      input: { image: new Uint8Array([1]) },
    });

    expect(result).toMatchObject({
      output: "A cat on a sofa.",
      usage: { chargedPoints: "0", modelId: "vision" },
    });
    expect(vision.doGenerateCalls).toHaveLength(1);
  });

  it("refuses an admin-assigned model that lacks a capability", async () => {
    const ledger = new MemoryAiLedger({
      actionSettings: { [ALT]: { modelId: "default" } },
    });
    const { runner } = setup({
      ledger,
      models: [
        textModel(answering("x")),
        textModel(answering("y"), {
          capabilities: ["text", "image-input"],
          id: "vision",
        }),
      ],
      userId: null,
    });

    expect(
      await codeOf(
        runner.runAsSystem({
          action: ALT,
          input: { image: new Uint8Array([1]) },
        }),
      ),
    ).toBe("AI_MODEL_INCOMPATIBLE");
  });
});

describe("system work", () => {
  const visionModels = [
    textModel(answering("A cat.", "A dog."), {
      capabilities: ["text", "image-input"],
    }),
  ];

  it("never touches personal points, but pays from the global budget", async () => {
    const ledger = new MemoryAiLedger({
      policy: () => ({ dailyLimit: 0, granted: false, monthlyPoints: 0n }),
    });
    const { runner } = setup({ ledger, models: visionModels, userId: null });

    await runner.runAsSystem({
      action: ALT,
      input: { image: new Uint8Array([1]) },
    });

    expect(ledger.spentUsd("global")).toBeGreaterThan(0n);
    expect(ledger.spentUsd("system")).toBe(ledger.spentUsd("global"));
    expect(
      [...ledger.budgets.values()].some(row =>
        row.scopeKey.startsWith("user:"),
      ),
    ).toBe(false);
  });

  it("stops at the global budget like everyone else", async () => {
    const ledger = new MemoryAiLedger({
      settings: { monthlyBudgetUsd: parseDecimal("0.000001") },
    });
    const { runner } = setup({ ledger, models: visionModels, userId: null });

    expect(
      await codeOf(
        runner.runAsSystem({
          action: ALT,
          input: { image: new Uint8Array([1]) },
        }),
      ),
    ).toBe("AI_BUDGET_EXHAUSTED");
  });
});

describe("AiRunner.stream", () => {
  const streaming = (chunks: string[]) =>
    new MockLanguageModelV4({
      doStream: async () =>
        Promise.resolve({
          stream: convertArrayToReadableStream([
            { id: "t", type: "text-start" },
            ...chunks.map(delta => ({
              delta,
              id: "t",
              type: "text-delta" as const,
            })),
            { id: "t", type: "text-end" },
            {
              finishReason: { raw: "stop", unified: "stop" },
              type: "finish",
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

  it("never streams from a model that does not declare streaming", async () => {
    const { runner } = setup({ models: [textModel(streaming(["x"]))] });

    expect(
      await codeOf(runner.stream({ action: SUMMARY, input: { text: "x" } })),
    ).toBe("AI_MODEL_INCOMPATIBLE");
  });

  const readAll = async (stream: ReadableStream<string>) => {
    let text = "";
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text;
      text += value;
    }
  };

  it("streams text and settles once the full answer is valid", async () => {
    const { ledger, runner } = setup({
      models: [
        textModel(streaming(["Hello", ", world"]), {
          capabilities: ["text", "streaming"],
        }),
      ],
    });

    const { result, textStream } = await runner.stream({
      action: SUMMARY,
      input: { text: "x" },
    });

    expect(await readAll(textStream)).toBe("Hello, world");
    expect(await result).toMatchObject({
      output: "Hello, world",
      usage: { chargedPoints: "20" },
    });
    expect(ledger.runs[0].status).toBe("succeeded");
  });

  it("charges no points when the reader cancels, and still records the run", async () => {
    const { ledger, runner } = setup({
      models: [
        textModel(streaming(["Hello", " there", " friend"]), {
          capabilities: ["text", "streaming"],
        }),
      ],
    });

    const { result, textStream } = await runner.stream({
      action: SUMMARY,
      input: { text: "x" },
    });
    const reader = textStream.getReader();
    await reader.read();
    await reader.cancel("user closed the panel");

    expect(await codeOf(result)).toBe("AI_CANCELED");
    expect(ledger.runs[0]).toMatchObject({ settled: true, status: "canceled" });
    expect(ledger.spentPoints(7)).toBe(0n);
  });
});
