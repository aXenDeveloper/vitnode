import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { CacheModel } from "@vitnode/core/api/lib/cache";
import { MemoryCacheStore } from "@vitnode/core/api/lib/cache-memory";
import { afterEach, describe, expect, it, vi } from "vitest";

import { articleContent } from "@/database/articles";

import { listCorrectionsRoute } from "./list.route";

type ArticlePublicService = ReturnType<
  NonNullable<typeof articleContent.publicService>
>;

const { publicService } = articleContent;

const listAs = async (article: null | object) => {
  articleContent.publicService = () =>
    ({
      findById: async () => await Promise.resolve(article),
    }) as unknown as ArticlePublicService;
  const listQuery = vi.fn(async () => await Promise.resolve([]));
  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("cache", new CacheModel(null, c as Context, new MemoryCacheStore()));
    c.set("db", {
      select: () => ({
        from: () => ({ where: () => ({ orderBy: listQuery }) }),
      }),
    } as unknown as Context["var"]["db"]);
    await next();
  });
  app.openapi(listCorrectionsRoute.route, listCorrectionsRoute.handler);

  return { listQuery, res: await app.request("/?articleId=3") };
};

afterEach(() => {
  articleContent.publicService = publicService;
});

describe("GET /corrections", () => {
  it("answers 404 for an article readers cannot see, without reading corrections", async () => {
    const { listQuery, res } = await listAs(null);

    expect(res.status).toBe(404);
    expect(listQuery).not.toHaveBeenCalled();
  });

  it("answers 200 with a public article's corrections", async () => {
    const { res } = await listAs({ id: 3 });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ corrections: [] });
  });
});
