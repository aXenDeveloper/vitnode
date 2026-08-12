import type { ReactElement } from "react";

import { describe, expect, it, vi } from "vitest";

import type { ContentColumnSpec } from "@/content/admin/spec";
import type { AnyContentTypeDefinition } from "@/content/types";

import {
  testArticleContentType,
  testEditorialPostContentType,
  testLocalizedPageContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { contentCellValue } from "./cells";

// Reached through the server actions the row buttons import.
vi.mock("server-only", () => ({}));

vi.mock("next-intl/server", () => ({
  // The language this person reads VitNode in. The list takes its display
  // language from here - there is no selector above the table and no
  // `?locale=` for one to write.
  getLocale: async () => {
    await Promise.resolve();

    return "pl";
  },
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

/** Every query the view sent, so the resolved locale can be asserted on. */
const fetchCalls: { query?: Record<string, unknown> }[] = [];
const fetchResult: unknown = { status: 200 };

vi.mock("@/content/admin/fetch.server", () => ({
  contentApiFetch: async (args: { query?: Record<string, unknown> }) => {
    await Promise.resolve();
    fetchCalls.push(args);

    return fetchResult;
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
 * The rendered `DataTable`.
 *
 * The view returns it directly now: there is nothing above the table for a
 * localized content type, because the language is the one the reader is already
 * using.
 */
const dataTable = <TProps,>(element: ReactElement): ReactElement<TProps> =>
  element as ReactElement<TProps>;

const render = async (
  definition: AnyContentTypeDefinition,
  searchParams: Record<string, string | string[] | undefined> = {},
  columnSpecs: ContentColumnSpec[] = [],
) => {
  fetchCalls.length = 0;

  return (await ContentTableView({
    columnSpecs,
    entry: {
      definition,
      pluginId: "@vitnode/example",
      registration: {},
    } as never,
    formSpec: {} as never,
    searchParams,
  })) as ReactElement;
};

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

describe("the display language", () => {
  const columns = async (
    definition: AnyContentTypeDefinition,
    searchParams: Record<string, string | string[] | undefined> = {},
    columnSpecs: ContentColumnSpec[] = [],
  ) =>
    dataTable<{ columns: { id?: string }[] }>(
      await render(definition, searchParams, columnSpecs),
    ).props.columns;

  it("reads the reader's own locale, with nothing above the table to pick it", async () => {
    await render(testLocalizedPageContentType);

    // `getLocale()` is `pl` in this suite. The list asks the API for Polish
    // without anybody choosing it, because the person is already reading Polish.
    expect(fetchCalls.at(-1)?.query).toMatchObject({ locale: "pl" });
  });

  it("keeps pagination and search working alongside it", async () => {
    await render(testLocalizedPageContentType, {
      cursor: "42",
      search: "hello",
    });

    expect(fetchCalls.at(-1)?.query).toMatchObject({
      cursor: "42",
      locale: "pl",
      search: "hello",
    });
  });

  it("ignores a stale `?locale=` rather than letting it disagree with the page", async () => {
    // A bookmark from the old selector must not put the table in one language
    // while the rest of the AdminCP is in another.
    await render(testLocalizedPageContentType, { locale: "en" });

    expect(fetchCalls.at(-1)?.query).toMatchObject({ locale: "pl" });
  });

  it("asks for no locale at all when the content type has no translations", async () => {
    await render(testEditorialPostContentType);

    expect(fetchCalls.at(-1)?.query).not.toHaveProperty("locale");
  });

  it("adds no separate translation column", async () => {
    // The old UX bolted a `Polish translation` column beside the shared ones.
    // A localized value is now shown in its own column, in the reader's
    // language, like any other.
    expect(
      (await columns(testLocalizedPageContentType)).map(column => column.id),
    ).not.toContain("translation");
  });

  it("shows a localized column from the row's own translation", async () => {
    const [first] = await columns(testLocalizedPageContentType, {}, [
      { kind: "text", label: "Title", localized: true, name: "title" },
    ]);
    const cell = (
      first as unknown as {
        cell: (context: { row: Record<string, unknown> }) => ReactElement;
      }
    ).cell({
      row: {
        id: 3,
        labels: {},
        translation: { locale: "pl", values: { title: "Witaj" } },
      },
    });
    const props = cell.props as {
      row: Record<string, unknown>;
      spec: ContentColumnSpec;
    };

    // The cell is handed the row *and* the localized spec, and reads the value
    // off the translation the list already resolved - one query for the page,
    // not one per row.
    expect(props.spec.localized).toBe(true);
    expect(contentCellValue(props.row as never, props.spec)).toBe("Witaj");
  });
});
