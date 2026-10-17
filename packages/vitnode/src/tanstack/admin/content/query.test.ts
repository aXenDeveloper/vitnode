import type { QueryClient } from "@tanstack/react-query";

import { describe, expect, it } from "vitest";

import type { AnyContentTypeDefinition } from "@/content/types";

import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import {
  contentItemQueryRoot,
  contentListQueryRoot,
  contentOptionsQueryRoot,
} from "@/views/admin/views/content/content-query";
import { SEARCH_QUERY_ROOT } from "@/views/search/search-feed-query";

import type { ContentListParams } from "./route-search";

import {
  contentApiTarget,
  contentListRequestFor,
  invalidateContentAfterWrite,
} from "./query";

const articles = defineContentType({
  id: "blog.post",
  tableName: "blog_post",
  fields: { title: field.text({ required: true }) },
  admin: { list: { orderableFields: ["title"] } },
}) as AnyContentTypeDefinition;

const pages = defineContentType({
  id: "blog.page",
  tableName: "blog_page",
  localization: { defaultLocale: "en", fallback: "default" },
  fields: { heading: field.text({ localized: true, required: true }) },
}) as AnyContentTypeDefinition;

const params: ContentListParams = { filters: {}, first: "25" };
const pluginId = "@vitnode/blog";

/** A query client that records what it was asked to do, and does nothing. */
const recordingClient = () => {
  const calls: { key: readonly unknown[]; type: "invalidate" | "remove" }[] =
    [];

  return {
    calls,
    client: {
      invalidateQueries: async ({
        queryKey,
      }: {
        queryKey: readonly unknown[];
      }) => {
        calls.push({ key: queryKey, type: "invalidate" });

        return Promise.resolve();
      },
      removeQueries: ({ queryKey }: { queryKey: readonly unknown[] }) => {
        calls.push({ key: queryKey, type: "remove" });
      },
    } as unknown as QueryClient,
  };
};

describe("contentApiTarget", () => {
  it("names the generated module rather than deriving one from the id", () => {
    // `permissionModule` may differ from the entity name, and guessing it would
    // address a route that does not exist.
    expect(contentApiTarget(articles, pluginId)).toEqual({
      permissionModule: articles.permissionModule,
      pluginId,
    });
  });
});

describe("contentListRequestFor", () => {
  it("sends the flattened URL contract", () => {
    expect(
      contentListRequestFor({
        definition: articles,
        locale: "pl",
        params: { filters: { status: "draft" }, first: "25" },
        pluginId,
      }).query,
    ).toEqual({ first: "25", status: "draft" });
  });

  it("attaches the viewing locale to a localized list", () => {
    expect(
      contentListRequestFor({
        definition: pages,
        locale: "pl",
        params,
        pluginId,
      }).locale,
    ).toBe("pl");
  });

  it("attaches none to a list that has no translations", () => {
    // Otherwise one cache entry per AdminCP language would hold identical rows.
    expect(
      contentListRequestFor({
        definition: articles,
        locale: "pl",
        params,
        pluginId,
      }).locale,
    ).toBeUndefined();
  });
});

describe("invalidateContentAfterWrite", () => {
  it("expires the list and the record, and drops every picker onto the type", async () => {
    const { calls, client } = recordingClient();

    await invalidateContentAfterWrite(client, {
      contentTypeId: "blog.post",
      itemId: 7,
    });

    expect(calls).toEqual([
      { key: contentOptionsQueryRoot("blog.post"), type: "remove" },
      { key: contentItemQueryRoot("blog.post", 7), type: "invalidate" },
      // Off-screen pages dropped, the one on screen refetched.
      { key: contentListQueryRoot("blog.post"), type: "remove" },
      { key: contentListQueryRoot("blog.post"), type: "invalidate" },
      { key: SEARCH_QUERY_ROOT, type: "invalidate" },
    ]);
  });

  it("removes a deleted record rather than marking it stale", async () => {
    // Its history, schedules and delivery state are facts about a row that is
    // gone; keeping them only lets something render them.
    const { calls, client } = recordingClient();

    await invalidateContentAfterWrite(client, {
      contentTypeId: "blog.post",
      itemId: 7,
      removed: true,
    });

    expect(calls).toContainEqual({
      key: contentItemQueryRoot("blog.post", 7),
      type: "remove",
    });
    expect(calls).not.toContainEqual({
      key: contentItemQueryRoot("blog.post", 7),
      type: "invalidate",
    });
  });

  it("removes the pickers rather than invalidating them", async () => {
    // The AdminCP's client is `refetchOnMount: false`, so a merely-stale picker
    // is still served from the cache and a deleted row stays on offer.
    const { calls, client } = recordingClient();

    await invalidateContentAfterWrite(client, { contentTypeId: "blog.post" });

    expect(calls).toContainEqual({
      key: contentOptionsQueryRoot("blog.post"),
      type: "remove",
    });
  });

  it("touches no record when the write did not name one", async () => {
    const { calls, client } = recordingClient();

    await invalidateContentAfterWrite(client, { contentTypeId: "blog.post" });

    expect(calls).toEqual([
      { key: contentOptionsQueryRoot("blog.post"), type: "remove" },
      // Off-screen pages dropped, the one on screen refetched.
      { key: contentListQueryRoot("blog.post"), type: "remove" },
      { key: contentListQueryRoot("blog.post"), type: "invalidate" },
      { key: SEARCH_QUERY_ROOT, type: "invalidate" },
    ]);
  });
});
