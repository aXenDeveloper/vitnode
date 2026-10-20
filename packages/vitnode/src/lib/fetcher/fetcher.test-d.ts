import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import type { ContentPublicRoutes } from "@/content/server/public-module";
import type { InferResponseType } from "@/lib/fetcher/types";

import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import { fetcherClient } from "@/lib/fetcher-client";
import { coreFetcher } from "@/lib/fetcher/core";

describe("a route's arguments are part of its type", () => {
  it("resolves the route from the registered plugin, without a module reference", async () => {
    const response = await coreFetcher({
      plugin: "@vitnode/core",
      method: "get",
      module: "users",
      path: "/session",
    });

    expectTypeOf(response.status).toEqualTypeOf<200>();
  });

  it("rejects a path the module does not serve", async () => {
    await coreFetcher({
      plugin: "@vitnode/core",
      method: "get",
      module: "users",
      // @ts-expect-error -- not a route on `users`
      path: "/not-a-route",
    });
  });

  it("rejects a call that omits a required body", async () => {
    // @ts-expect-error -- `/sign_in` declares a body, so `args` is required
    await coreFetcher({
      plugin: "@vitnode/core",
      method: "post",
      module: "users",
      path: "/sign_in",
    });
  });

  it("rejects a body the route does not declare", async () => {
    await coreFetcher({
      plugin: "@vitnode/core",
      // @ts-expect-error -- `nickname` is not on the sign-in schema
      args: { body: { email: "a@b.c", nickname: "x", password: "y" } },
      method: "post",
      module: "users",
      path: "/sign_in",
    });
  });

  it("rejects a call that omits a required path parameter", async () => {
    // @ts-expect-error -- `/devices/{publicId}` declares params
    await fetcherClient({
      plugin: "@vitnode/core",
      method: "delete",
      module: "users",
      path: "/devices/{publicId}",
    });
  });

  it("infers the response body from the route's schema", async () => {
    const response = await coreFetcher({
      plugin: "@vitnode/core",
      method: "get",
      module: "users",
      path: "/session",
    });

    expectTypeOf((await response.json()).user).not.toBeAny();
  });
});

describe("a JSON response is typed as it arrives", () => {
  it("reads a date as its ISO string, nested and nullable too, and leaves the rest alone", async () => {
    const schema = z.object({
      createdAt: z.date(),
      count: z.number(),
      name: z.string(),
      tags: z.array(z.string()),
      author: z.object({ joinedAt: z.date(), bannedAt: z.date().nullable() }),
    });
    interface DatedRoute {
      responses: {
        200: {
          content: { "application/json": { schema: typeof schema } };
          description: string;
        };
        404: { description: string };
      };
    }
    const response = {} as InferResponseType<DatedRoute>;

    if (response.status === 200) {
      expectTypeOf(await response.json()).toEqualTypeOf<{
        author: { bannedAt: null | string; joinedAt: string };
        count: number;
        createdAt: string;
        name: string;
        tags: string[];
      }>();
    }
  });

  it("types a content list row from `listFields` and the detail row from `fields`", async () => {
    const listed = defineContentType({
      id: "test.fetcher-listed",
      tableName: "test_fetcher_listed",
      fields: {
        title: field.text({ required: true }),
        slug: field.slug({ source: "title" }),
        body: field.textarea({ nullable: true }),
      },
      publication: true,
      publicApi: {
        path: "listed",
        fields: ["title", "slug", "body", "publishedAt"],
        listFields: ["title", "slug", "publishedAt"],
      },
    });
    type Routes = ContentPublicRoutes<"test", typeof listed>[number]["route"];
    type ListRoute = Extract<Routes, { method: "get"; path: "/" }>;
    type DetailRoute = Extract<Routes, { method: "get"; path: "/{slug}" }>;
    const list = {} as InferResponseType<ListRoute>;
    const detail = {} as InferResponseType<DetailRoute>;

    if (list.status === 200) {
      expectTypeOf((await list.json()).edges).toEqualTypeOf<
        { publishedAt: null | string; slug: string; title: string }[]
      >();
    }
    if (detail.status === 200) {
      expectTypeOf(await detail.json()).toEqualTypeOf<{
        body: null | string;
        publishedAt: null | string;
        slug: string;
        title: string;
      }>();
    }
  });
});
