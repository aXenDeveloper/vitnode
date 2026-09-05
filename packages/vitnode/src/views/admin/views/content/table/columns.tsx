import type { ColumnDef } from "@/components/table/data-table-content";
import type { ContentColumnSpec } from "@/content/admin/spec";
import type { AnyContentTypeDefinition } from "@/content/types";
import type { ContentTypeFrontendRegistration } from "@/lib/plugin";

import { orderableColumns } from "@/content/registry";

import type { ContentRowData } from "./cells";

import { ContentCell } from "./cells";

/** The actions column is as wide as its buttons and no wider. */
const ACTION_WIDTH = "w-0 whitespace-nowrap";

/** A plugin's replacement for one generated cell. */
export type ContentColumnOverride = (props: { row: never }) => React.ReactNode;

export const contentColumnEntries = (
  columnSpecs: readonly ContentColumnSpec[],
  registration: Pick<ContentTypeFrontendRegistration, "columns">,
): { cell?: ContentColumnOverride; spec: ContentColumnSpec }[] =>
  columnSpecs.map(spec => {
    const override = registration.columns?.[spec.name];

    return override ? { cell: override.cell, spec } : { spec };
  });

export const contentTableColumnCount = (
  columnSpecs: readonly ContentColumnSpec[],
): number => columnSpecs.length + 1;

/** Whether this content type's list renders a search box. */
export const contentTableSearchEnabled = (
  definition: AnyContentTypeDefinition,
): boolean => definition.admin.list.searchableFields.length > 0;

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
