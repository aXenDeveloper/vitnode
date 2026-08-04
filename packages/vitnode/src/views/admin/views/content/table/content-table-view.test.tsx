import type { ReactElement } from "react";

import { describe, expect, it, vi } from "vitest";

import type { AnyContentTypeDefinition } from "@/content/types";

import {
  testArticleContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

// Reached through the server actions the row buttons import.
vi.mock("server-only", () => ({}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => {
    await Promise.resolve();

    return (key: string) => key;
  },
}));

// Pulled in transitively by the row actions, and it builds a real next-intl
// router at module scope.
vi.mock("@/lib/navigation", () => ({
  Link: () => null,
  getPathname: () => "",
  redirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

vi.mock("@/content/admin/fetch.server", () => ({
  contentApiFetch: async () => {
    await Promise.resolve();

    return { status: 200 };
  },
}));

const { ContentTableView } = await import("./content-table-view");

/**
 * The `order` prop the view hands `DataTable`.
 *
 * Rendering is beside the point here: what the table can sort by is decided
 * before a single row exists, and getting it wrong shows up as a header with no
 * button rather than as an error.
 */
const orderProp = async (definition: AnyContentTypeDefinition) => {
  const element = (await ContentTableView({
    columnSpecs: [],
    entry: {
      definition,
      pluginId: "@vitnode/example",
      registration: {},
    } as never,
    formSpec: {} as never,
    searchParams: {},
  })) as ReactElement<{
    order: { columns: string[]; defaultOrder: { column: string } };
  }>;

  return element.props.order;
};

describe("sortable columns", () => {
  it("offers every column the generated route accepts", async () => {
    // The route's `orderBy` enum is `orderableColumns(definition)`. Passing
    // anything narrower here leaves a header unsortable that the backend would
    // have answered.
    expect((await orderProp(testPostContentType)).columns).toEqual([
      "title",
      "id",
      "createdAt",
      "updatedAt",
      "status",
      "publishedAt",
    ]);
  });

  it.each(["id", "createdAt", "updatedAt"])(
    "includes the system column %s",
    async name => {
      expect((await orderProp(testPostContentType)).columns).toContain(name);
    },
  );

  it.each(["status", "publishedAt"])(
    "includes the publication column %s",
    async name => {
      expect((await orderProp(testPostContentType)).columns).toContain(name);
    },
  );

  it("invents no publication columns without publication", async () => {
    const columns = (await orderProp(testArticleContentType)).columns;

    // `test.article` declares its own `status` field and does not opt into
    // publication, so `status` is sortable only because it is in the configured
    // allowlist - and `publishedAt` does not exist at all.
    expect(columns).not.toContain("publishedAt");
    expect(columns).toEqual([
      "title",
      "status",
      "id",
      "createdAt",
      "updatedAt",
    ]);
  });

  it("keeps the configured fields sortable", async () => {
    expect((await orderProp(testPostContentType)).columns).toContain("title");
  });

  it("leaves the configured default ordering alone", async () => {
    expect((await orderProp(testPostContentType)).defaultOrder).toEqual({
      column: "publishedAt",
      order: "desc",
    });
  });
});
