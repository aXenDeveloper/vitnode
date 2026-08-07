import type { ReactElement } from "react";

import { describe, expect, it, vi } from "vitest";

import type { AnyContentTypeDefinition } from "@/content/types";

import {
  testArticleContentType,
  testEditorialPostContentType,
  testLocalizedPageContentType,
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
const { DeleteContentAction } = await import("../actions/delete-action");

/**
 * The `order` prop the view hands `DataTable`.
 *
 * Rendering is beside the point here: what the table can sort by is decided
 * before a single row exists, and getting it wrong shows up as a header with no
 * button rather than as an error.
 */
/**
 * The rendered `DataTable`, whichever wrapper it came back inside.
 *
 * The view returns a fragment - a localized content type gets a locale selector
 * above the table - so the table is found rather than assumed to be the root.
 */
const dataTable = <TProps,>(element: ReactElement): ReactElement<TProps> => {
  const children = (element.props as { children?: unknown }).children;
  if (children === undefined) return element as ReactElement<TProps>;

  const found = (Array.isArray(children) ? children : [children]).find(
    child =>
      child !== null &&
      typeof child === "object" &&
      "props" in child &&
      "columns" in (child as ReactElement<Record<string, unknown>>).props,
  );

  return (found ?? element) as ReactElement<TProps>;
};

const render = async (
  definition: AnyContentTypeDefinition,
  searchParams: Record<string, string | string[] | undefined> = {},
) =>
  (await ContentTableView({
    columnSpecs: [],
    entry: {
      definition,
      pluginId: "@vitnode/example",
      registration: {},
    } as never,
    formSpec: {} as never,
    searchParams,
    translationSpec: null,
  })) as ReactElement;

const orderProp = async (definition: AnyContentTypeDefinition) =>
  dataTable<{ order: { columns: string[]; defaultOrder: { column: string } } }>(
    await render(definition),
  ).props.order;

/**
 * The props the actions cell hands `DeleteContentAction` for one row.
 *
 * The cell is a plain function returning a fragment, so it can be called and
 * walked without a DOM - which is the cheapest way to assert what a row action
 * is actually given.
 */
const deleteProps = async (
  definition: AnyContentTypeDefinition,
  row: Record<string, unknown>,
) => {
  const element = dataTable<{
    columns: {
      cell?: (context: { row: Record<string, unknown> }) => ReactElement<{
        children: ReactElement<Record<string, unknown>>[];
      }>;
      id?: string;
    }[];
  }>(await render(definition));

  const actions = element.props.columns.find(column => column.id === "actions");
  const rendered = actions?.cell?.({ row });

  return rendered?.props.children.find(
    child => child?.type === DeleteContentAction,
  )?.props;
};

describe("the delete row action", () => {
  it("is handed the version the row is showing", async () => {
    // The precondition the editorial delete route requires. Taken from the row
    // in front of the person, so a stale table cannot remove a newer record.
    expect(
      await deleteProps(testEditorialPostContentType, { id: 7, version: 4 }),
    ).toMatchObject({ id: 7, version: 4 });
  });

  it("is handed no version without editorial", async () => {
    // `test.post` has no `version` column and its delete route takes no body.
    expect(await deleteProps(testPostContentType, { id: 7 })).toMatchObject({
      version: undefined,
    });
  });
});

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

describe("the locale selector", () => {
  const columns = async (
    definition: AnyContentTypeDefinition,
    searchParams: Record<string, string | string[] | undefined> = {},
  ) =>
    dataTable<{ columns: { id?: string }[] }>(
      await render(definition, searchParams),
    ).props.columns;

  it("adds no translation column without a language", async () => {
    // The list is unchanged until somebody picks one. `Shared` is a real choice,
    // not a fallback state.
    expect(
      (await columns(testLocalizedPageContentType)).map(column => column.id),
    ).not.toContain("translation");
  });

  it("adds one when a language is selected", async () => {
    expect(
      (await columns(testLocalizedPageContentType, { locale: "pl" })).map(
        column => column.id,
      ),
    ).toContain("translation");
  });

  it("puts it first, because it is what the person came to read", async () => {
    const [first] = await columns(testLocalizedPageContentType, {
      locale: "pl",
    });

    expect(first.id).toBe("translation");
  });

  it("adds nothing to a content type that is not localized", async () => {
    expect(
      (await columns(testEditorialPostContentType, { locale: "pl" })).map(
        column => column.id,
      ),
    ).not.toContain("translation");
  });
});
