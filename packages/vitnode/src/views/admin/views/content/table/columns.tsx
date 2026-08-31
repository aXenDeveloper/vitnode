import type { ColumnDef } from "@/components/table/data-table-content";
import type { ContentColumnSpec } from "@/content/admin/spec";
import type { AnyContentTypeDefinition } from "@/content/types";
import type { ContentTypeFrontendRegistration } from "@/lib/plugin";

import { orderableColumns } from "@/content/registry";

import type { ContentRowData } from "./cells";

import { ContentCell } from "./cells";

/**
 * A generated content list's columns, built once for both AdminCPs.
 *
 * A plain function rather than a component, and that is what makes it shareable
 * at all. The Next.js list assembles its table in a Server Component, so its
 * `cell` closures run on the server; the TanStack Start list assembles the same
 * table in a client one. Neither can hand the other a component through props -
 * a plugin's column override is a React component, and those do not cross an RSC
 * boundary - but both can *call* this, in their own environment, with the
 * registration they can already see.
 *
 * Everything locale-dependent arrives as a resolved string for the same reason:
 * one host has `getTranslations()` and the other has `useTranslations()`, and a
 * function that took either would only work in one of them.
 *
 *     Next.js         content-table-view.tsx  getTranslations + server fetch
 *     TanStack Start  tanstack/admin/content  useTranslations + useSuspenseQuery
 *                                \          /
 *                          buildContentTableColumns
 */

/** The actions column is as wide as its buttons and no wider. */
const ACTION_WIDTH = "w-0 whitespace-nowrap";

/** A plugin's replacement for one generated cell. */
export type ContentColumnOverride = (props: { row: never }) => React.ReactNode;

/**
 * One column, paired with the override that replaces its cell - or nothing.
 *
 * Pure and separately testable, because "which columns exist, in which order,
 * and which of them a plugin took over" is the whole of what a registration can
 * change about a table, and it is worth being able to state that without
 * rendering anything.
 *
 * The lookup is by column *name*, which is the field name - so an override
 * survives a column being relabelled, reordered, or translated, and an override
 * naming a column the content type does not have is simply never reached rather
 * than being an error. `contentTypeAdmin()` already type-checks the names
 * against the definition, so an unreachable one is a plugin editing its
 * definition without editing its overrides.
 */
export const contentColumnEntries = (
  columnSpecs: readonly ContentColumnSpec[],
  registration: Pick<ContentTypeFrontendRegistration, "columns">,
): { cell?: ContentColumnOverride; spec: ContentColumnSpec }[] =>
  columnSpecs.map(spec => {
    const override = registration.columns?.[spec.name];

    return override ? { cell: override.cell, spec } : { spec };
  });

/**
 * How many columns the table has, including the actions one.
 *
 * The skeleton's only input, and it is here so the shape that is rendered while
 * the rows load is the shape they arrive into. The Next.js page has always
 * spelled this `columnSpecs.length + 1`; naming it is what stops the two hosts
 * disagreeing by one column.
 */
export const contentTableColumnCount = (
  columnSpecs: readonly ContentColumnSpec[],
): number => columnSpecs.length + 1;

/** Whether this content type's list renders a search box. */
export const contentTableSearchEnabled = (
  definition: AnyContentTypeDefinition,
): boolean => definition.admin.list.searchableFields.length > 0;

/**
 * Which columns sort, and how the list is sorted before anybody asks.
 *
 * Column names as plain strings rather than `keyof` anything: a content type's
 * fields are its own, and the row type a table infers is whatever its response
 * schema produced. `DataTable` widens them per instantiation, which is what lets
 * one function serve every content type.
 */
export const contentTableOrder = (
  definition: AnyContentTypeDefinition,
): {
  columns: string[];
  defaultOrder: { column: string; order: "asc" | "desc" };
} => ({
  columns: orderableColumns(definition),
  defaultOrder: {
    column: definition.admin.list.defaultOrderBy,
    order: definition.admin.list.defaultOrder,
  },
});

/**
 * What a row is called, for the sentences an action has to write.
 *
 * "Delete <title>?" and "Publish <title>?" both name the record, and a record
 * with no title field - or one whose title has not been translated into the
 * language being read - still has to be named something. `#42` is that
 * something: it is unambiguous, it matches the `id` column already on screen,
 * and it is what the Next.js list has always fallen back to.
 *
 * The localized branch is the one worth stating: a localized title lives on the
 * translation rather than on the row, so it is read from `translation.values`.
 * A record nobody has translated into this language has no translation at all,
 * and falls back like an untitled one.
 */
export const contentRowTitle = (
  definition: AnyContentTypeDefinition,
  row: ContentRowData,
): string => {
  const titleField = definition.admin.titleField;
  if (titleField === null) return `#${row.id}`;

  const value =
    definition.fields[titleField]?.localized === true
      ? row.translation?.values?.[titleField]
      : row[titleField];

  return typeof value === "string" && value !== "" ? value : `#${row.id}`;
};

/** The strings a generated cell renders, already in the reader's language. */
export interface ContentCellLabels {
  /** `core.content.table.empty_value` - a column this row has no value for. */
  empty: string;
  /** `core.content.translations.states.missing` - untranslated in this language. */
  missing?: string;
  /** `core.content.status.*`, for the publication badge. */
  status: { draft: string; published: string };
}

export interface ContentTableColumnsArgs {
  columnSpecs: readonly ContentColumnSpec[];
  labels: ContentCellLabels;
  registration: Pick<ContentTypeFrontendRegistration, "columns">;
  /**
   * The row's action cluster - publish, edit, and the overflow menu.
   *
   * A render function rather than a component, so the caller keeps whatever it
   * needs in scope (a query client, a locale, a link component) without any of
   * it having to travel through this module. Absent means the table has no
   * actions column at all, which is what a read-only rendering of a list wants.
   */
  renderRowActions?: (row: ContentRowData) => React.ReactNode;
}

/**
 * The generated columns, then the actions.
 *
 * A custom cell is handed **the same row** a generated one gets - the API's row
 * object, untouched - which is the contract `ContentCellProps` states and the
 * reason a plugin's cell can read a field the engine knows nothing about. The
 * cast is that contract crossing an erased generic: the registration's own type
 * is `ContentSelect<TDefinition>` and this function is generic over none of
 * them, so the row's real shape is proven by the API's schema rather than here.
 */
export const buildContentTableColumns = ({
  columnSpecs,
  labels,
  registration,
  renderRowActions,
}: ContentTableColumnsArgs): ColumnDef<ContentRowData>[] => [
  ...contentColumnEntries(columnSpecs, registration).map(
    ({ cell: Override, spec }): ColumnDef<ContentRowData> => ({
      accessorKey: spec.name,
      header: spec.label,

      cell: ({ row }) =>
        Override ? (
          <Override row={row as never} />
        ) : (
          <ContentCell
            emptyLabel={labels.empty}
            missingLabel={labels.missing}
            row={row}
            spec={spec}
            statusLabels={labels.status}
          />
        ),
    }),
  ),
  ...(renderRowActions
    ? [
        {
          id: "actions",
          header: "",
          align: "right",
          className: ACTION_WIDTH,
          // A fragment rather than the node itself: `React.ReactNode` includes a
          // promise in React 19's types, and a `cell` is called during render.
          cell: ({ row }) => <>{renderRowActions(row)}</>,
        } satisfies ColumnDef<ContentRowData>,
      ]
    : []),
];
