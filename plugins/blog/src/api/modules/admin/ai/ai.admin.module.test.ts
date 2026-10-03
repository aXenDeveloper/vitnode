// @vitest-environment node
import type { CacheClient } from "@vitnode/core/api/lib/cache";
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { CacheModel } from "@vitnode/core/api/lib/cache";
import { writeStaffPermissions } from "@vitnode/core/api/lib/staff-permission-cache";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

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
  model = modelAnswering("Cześć"),
}: {
  canEdit?: boolean;
  configured?: boolean;
  model?: MockLanguageModelV4;
} = {}) => {
  const cache = createCache();
  await grant(cache, canEdit);

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin" as never, { user: { id: EDITOR_ID } } as never);
    c.set("cache" as never, cache as never);
    c.set(
      "core" as never,
      { ai: configured ? { models: [{ id: "default" }] } : undefined } as never,
    );
    c.set("ai" as never, { model: () => model } as never);
    await next();
  });
  app.openapi(translateAiAdminRoute.route, translateAiAdminRoute.handler);
  app.openapi(excerptAiAdminRoute.route, excerptAiAdminRoute.handler);

  return { app, model };
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

  it("keeps HTML intact when translating content", async () => {
    const { app, model } = await createApp({
      model: modelAnswering("<p>Cześć</p>\n"),
    });

    const response = await post(app, "/translate", {
      format: "html",
      from: "en",
      text: "<p>Hello</p>",
      to: "pl",
    });

    expect(await response.json()).toEqual({ text: "<p>Cześć</p>" });
    expect(promptOf(model.doGenerateCalls[0])).toContain("Keep every tag");
  });

  it("writes an excerpt from the article text", async () => {
    const { app, model } = await createApp({
      model: modelAnswering(
        "One definition per content type and faster lists.",
      ),
    });

    const response = await post(app, "/excerpt", {
      content: "<h2>Why</h2><p>We rebuilt the AdminCP.</p>",
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
    expect(promptOf(model.doGenerateCalls[0])).not.toContain("<p>");
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
      content: "<p>Body</p>",
      locale: "en",
      title: "Title",
    });

    expect(response.status).toBe(400);
    expect(model.doGenerateCalls).toHaveLength(0);
  });
});
