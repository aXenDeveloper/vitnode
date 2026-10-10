// @vitest-environment node
import type { CacheClient } from "@vitnode/core/api/lib/cache";
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { MemoryAiLedger } from "@vitnode/core/api/lib/ai/memory-ledger";
import { collectAiActions } from "@vitnode/core/api/lib/ai/registry";
import { CacheModel } from "@vitnode/core/api/lib/cache";
import { writeStaffPermissions } from "@vitnode/core/api/lib/staff-permission-cache";
import { AIModel } from "@vitnode/core/api/models/ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { ARTICLE_REVIEW_AI_ACTION, blogAiActions } from "@/api/ai/actions";

import { excerptAiAdminRoute } from "./routes/excerpt.route";
import { translateAiAdminRoute } from "./routes/translate.route";

const EDITOR_ID = 7;

const createCache = () => {
  const store = new Map<string, string>();
  const client = {
    del: async (keys: string | string[]) =>
      Promise.resolve(
        (Array.isArray(keys) ? keys : [keys]).filter(key => store.delete(key))
          .length,
      ),
    exists: async (key: string) => Promise.resolve(store.has(key) ? 1 : 0),
    get: async (key: string) => Promise.resolve(store.get(key) ?? null),
    ping: async () => Promise.resolve("PONG"),
    set: async (key: string, value: string) => {
      store.set(key, value);

      return Promise.resolve("OK");
    },
  } as unknown as CacheClient;

  return new CacheModel(client, { get: () => undefined } as unknown as Context);
};

const grant = async (cache: CacheModel, canEdit: boolean) => {
  await writeStaffPermissions(
    {
      get: (key: string) => (key === "cache" ? cache : undefined),
    } as unknown as Context,
    { type: "admin", userId: EDITOR_ID },
    {
      permissions: [
        { module: "posts", permission: "can_view", plugin: "@vitnode/blog" },
        ...(canEdit
          ? [
              {
                module: "posts",
                permission: "can_edit",
                plugin: "@vitnode/blog",
              },
            ]
          : []),
      ],
      root: false,
      staff: true,
    },
  );
};

const bodyDocument = {
  content: [{ content: [{ text: "Body", type: "text" }], type: "paragraph" }],
  type: "doc",
};

const modelAnswering = (text: string) =>
  new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: "text", text }],
      finishReason: { raw: "stop", unified: "stop" },
      usage: {
        inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
        outputTokens: { reasoning: 0, text: 5, total: 5 },
      },
      warnings: [],
    },
  });

const createApp = async ({
  canEdit = true,
  configured = true,
  ledger = new MemoryAiLedger(),
  model = modelAnswering("Cześć"),
}: {
  canEdit?: boolean;
  configured?: boolean;
  ledger?: MemoryAiLedger;
  model?: MockLanguageModelV4;
} = {}) => {
  const cache = createCache();
  await grant(cache, canEdit);
  const aiActions = collectAiActions([
    { aiActions: blogAiActions, pluginId: "@vitnode/blog" },
  ]);

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin" as never, { user: { id: EDITOR_ID } } as never);
    c.set("cache" as never, cache as never);
    c.set(
      "core" as never,
      {
        ai: configured
          ? {
              models: [
                {
                  id: "default",
                  model,
                  name: "Test",
                  pricing: {
                    rates: { inputPerMillion: "3", outputPerMillion: "15" },
                  },
                },
              ],
            }
          : undefined,
        aiActions,
      } as never,
    );
    c.set("ai" as never, new AIModel(c as Context, { ledger }) as never);
    await next();
  });
  app.openapi(translateAiAdminRoute.route, translateAiAdminRoute.handler);
  app.openapi(excerptAiAdminRoute.route, excerptAiAdminRoute.handler);

  return { app, ledger, model };
};

const post = async (app: OpenAPIHono, path: string, body: unknown) =>
  await app.request(path, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

const promptOf = (
  call: MockLanguageModelV4["doGenerateCalls"][number] | undefined,
) => JSON.stringify(call?.prompt ?? []);

describe("blog AI admin routes", () => {
  it("translates a field into the target language", async () => {
    const { app, model } = await createApp({
      model: modelAnswering("“Cześć, świecie”"),
    });

    const response = await post(app, "/translate", {
      format: "text",
      from: "en",
      text: "Hello, world",
      to: "pl",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "Cześć, świecie" });
    expect(promptOf(model.doGenerateCalls[0])).toContain("into Polish");
    expect(promptOf(model.doGenerateCalls[0])).toContain("Hello, world");
  });

  it("translates a rich text document as HTML, keeping its markup", async () => {
    const { app, model } = await createApp({
      model: modelAnswering("<p><strong>Cześć</strong></p>\n"),
    });

    const response = await post(app, "/translate", {
      document: {
        content: [
          {
            content: [
              { marks: [{ type: "bold" }], text: "Hello", type: "text" },
            ],
            type: "paragraph",
          },
        ],
        type: "doc",
      },
      format: "richText",
      from: "en",
      to: "pl",
    });

    expect(await response.json()).toEqual({
      text: "<p><strong>Cześć</strong></p>",
    });
    expect(promptOf(model.doGenerateCalls[0])).toContain("Keep every tag");
    expect(promptOf(model.doGenerateCalls[0])).toContain(
      "<p><strong>Hello</strong></p>",
    );
  });

  it("refuses an empty document before asking the model", async () => {
    const { app, model } = await createApp();

    const response = await post(app, "/translate", {
      document: { content: [{ type: "paragraph" }], type: "doc" },
      format: "richText",
      from: "en",
      to: "pl",
    });

    expect(response.status).toBe(400);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("writes an excerpt from the article text", async () => {
    const { app, model } = await createApp({
      model: modelAnswering(
        "One definition per content type and faster lists.",
      ),
    });

    const response = await post(app, "/excerpt", {
      content: {
        content: [
          {
            attrs: { level: 2 },
            content: [{ text: "Why", type: "text" }],
            type: "heading",
          },
          {
            content: [{ text: "We rebuilt the AdminCP.", type: "text" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      },
      locale: "en",
      title: "VitNode 2.0",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      text: "One definition per content type and faster lists.",
    });
    expect(promptOf(model.doGenerateCalls[0])).toContain(
      "We rebuilt the AdminCP.",
    );
    expect(promptOf(model.doGenerateCalls[0])).not.toContain("paragraph");
  });

  it("refuses staff who cannot edit articles", async () => {
    const { app, model } = await createApp({ canEdit: false });

    const response = await post(app, "/translate", {
      format: "text",
      from: "en",
      text: "Hello",
      to: "pl",
    });

    expect(response.status).toBe(403);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("answers 400 when no AI model is configured", async () => {
    const { app, model } = await createApp({ configured: false });

    const response = await post(app, "/excerpt", {
      content: {
        content: [
          { content: [{ text: "Body", type: "text" }], type: "paragraph" },
        ],
        type: "doc",
      },
      locale: "en",
      title: "Title",
    });

    expect(response.status).toBe(400);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("runs through the shared runner and records the run", async () => {
    const { app, ledger } = await createApp();

    await post(app, "/translate", {
      format: "text",
      from: "en",
      text: "Hello",
      to: "pl",
    });

    expect(ledger.runs).toMatchObject([
      {
        actionKey: "@vitnode/blog:field.translate",
        status: "succeeded",
        userId: EDITOR_ID,
      },
    ]);
  });

  it("refuses a rich-text translation that changed the document structure", async () => {
    const { app } = await createApp({
      model: modelAnswering(
        '<p>Cześć <a href="https://evil.test">link</a></p>',
      ),
    });

    const response = await post(app, "/translate", {
      document: {
        content: [
          {
            content: [
              { text: "Hello ", type: "text" },
              {
                marks: [
                  { attrs: { href: "https://vitnode.com" }, type: "link" },
                ],
                text: "link",
                type: "text",
              },
            ],
            type: "paragraph",
          },
        ],
        type: "doc",
      },
      format: "richText",
      from: "en",
      to: "pl",
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "AI_INVALID_OUTPUT" });
  });

  it("answers 429 with a stable code when the editor's points are used up", async () => {
    const { app, model } = await createApp({
      ledger: new MemoryAiLedger({
        policy: () => ({ dailyLimit: null, granted: true, monthlyPoints: 0n }),
      }),
    });

    const response = await post(app, "/excerpt", {
      content: bodyDocument,
      locale: "en",
      title: "Title",
    });

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      code: "AI_USER_LIMIT_REACHED",
    });
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("returns a structured, validated review and never claims to check facts", async () => {
    const review = {
      suggestions: [
        {
          area: "clarity",
          fix: {
            quote: "RLS",
            replacement: "row level security (RLS)",
          },
          message: "Define RLS first.",
          priority: "high",
        },
        {
          area: "structure",
          fix: null,
          message: "Add a conclusion.",
          priority: "low",
        },
      ],
      summary: "Clear overall.",
    };
    const model = modelAnswering(JSON.stringify(review));
    const app = new OpenAPIHono();
    app.use("*", async (c, next) => {
      c.set("admin" as never, { user: { id: EDITOR_ID } } as never);
      c.set("cache" as never, cache as never);
      c.set(
        "core" as never,
        {
          ai: {
            models: [
              {
                capabilities: ["text", "structured-output"],
                id: "default",
                model,
                name: "Test",
                pricing: {
                  rates: { inputPerMillion: "3", outputPerMillion: "15" },
                },
              },
            ],
          },
          aiActions: collectAiActions([
            { aiActions: blogAiActions, pluginId: "@vitnode/blog" },
          ]),
        } as never,
      );
      c.set(
        "ai" as never,
        new AIModel(c as Context, { ledger: new MemoryAiLedger() }) as never,
      );
      await next();
    });
    app.post("/review", async c => {
      const result = await c.get("ai").run({
        action: ARTICLE_REVIEW_AI_ACTION,
        input: { content: bodyDocument, locale: "en", title: "Title" },
      });

      return c.json(result.output);
    });
    const cache = createCache();
    await grant(cache, true);

    const response = await app.request("/review", { method: "POST" });

    expect(await response.json()).toEqual(review);
    expect(promptOf(model.doGenerateCalls[0])).toContain("cannot verify them");
    expect(promptOf(model.doGenerateCalls[0])).toContain(
      "copied character for character",
    );
  });

  it("refuses the review on a model without structured output", async () => {
    const { app, model } = await createApp();
    app.post("/review", async c => {
      await c.get("ai").run({
        action: ARTICLE_REVIEW_AI_ACTION,
        input: { content: bodyDocument, locale: "en", title: "Title" },
      });

      return c.json({});
    });

    const response = await app.request("/review", { method: "POST" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "AI_MODEL_INCOMPATIBLE",
    });
    expect(model.doGenerateCalls).toHaveLength(0);
  });
});
