import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";

import type { ColumnDef } from "@/components/table/data-table";
import type { RegisteredFrontendContentType } from "@/content/admin/config";
import type { ContentColumnSpec, ContentFormSpec } from "@/content/admin/spec";

import { zodPaginationPageInfo } from "@/api/lib/with-pagination";
import { DataTable } from "@/components/table/data-table";
import { contentApiFetch } from "@/content/admin/fetch.server";
import { contentEditHref, orderableColumns } from "@/content/registry";

import type { ContentRowData } from "./cells";

import { EditContentAction } from "../actions/edit-action";
import { PublishContentAction } from "../actions/publish-action";
import { ContentRowActionsMenu } from "../actions/row-actions-menu";
import { ContentCell } from "./cells";

/**
 * Width of the actions column: Edit and the ⋯ menu, plus the publish toggle for a
 * content type with `publication`. Three buttons is the ceiling now, whatever the
 * content type opts into - everything else is listed inside the menu.
 */
const ACTION_WIDTHS = ["w-20", "w-28"] as const;

const zodList = z.object({
  edges: z.array(
    z
      .object({
        id: z.number(),
        labels: z.record(z.string(), z.string().nullable()),
        /** The record's translation in the reader's own language. */
        translation: z
          .object({
            locale: z.string(),
            status: z.string().optional(),
            title: z.string(),
            values: z.record(z.string(), z.unknown()),
          })
          .nullable()
          .optional(),
      })
      .loose(),
  ),
  pageInfo: zodPaginationPageInfo,
});

export const ContentTableView = async ({
  columnSpecs,
  entry,
  formSpec,
  searchParams,
}: {
  columnSpecs: ContentColumnSpec[];
  entry: RegisteredFrontendContentType;
  formSpec: ContentFormSpec;
  searchParams: Record<string, string | string[] | undefined>;
}) => {
  const [t, locale] = await Promise.all([
    getTranslations("core.content"),
    // The language this person is already using VitNode in. There is no locale
    // control above the table, and there is nothing for one to add: somebody
    // reading the AdminCP in Polish came to read Polish content.
    getLocale(),
  ]);
  const { definition, pluginId, registration } = entry;
  const localized = definition.localization.enabled;

  const result = await contentApiFetch({
    definition,
    method: "get",
    pluginId,
    // `locale` last, so a stale bookmark carrying `?locale=` cannot make the
    // list disagree with the language the rest of the screen is in.
    query: localized ? { ...searchParams, locale } : searchParams,
    schema: zodList,
  });

  const data = result.data ?? {
    edges: [],
    pageInfo: {
      count: 0,
      endCursor: null,
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      totalCount: 0,
    },
  };

  const emptyLabel = t("table.empty_value");
  const missingLabel = t("translations.states.missing");
  const statusLabels = {
    draft: t("status.draft"),
    published: t("status.published"),
  };
  const titleField = definition.admin.titleField;
  const localizedTitle =
    titleField !== null && definition.fields[titleField]?.localized === true;

  /**
   * The record's human name, in the language this person is reading.
   *
   * A localized title comes off the translation the list already resolved, so a
   * toast, a tooltip and a confirmation dialog all say the same thing the row
   * above them says - and `#123` is the last resort rather than the normal one.
   */
  const titleOf = (row: ContentRowData): string => {
    if (titleField === null) return `#${row.id}`;

    const value = localizedTitle
      ? row.translation?.values?.[titleField]
      : row[titleField];

    return typeof value === "string" && value !== "" ? value : `#${row.id}`;
  };

  const columns: ColumnDef<ContentRowData>[] = [
    ...columnSpecs.map((spec): ColumnDef<ContentRowData> => {
      const override = registration.columns?.[spec.name];

      return {
        accessorKey: spec.name,
        header: spec.label,

        cell: ({ row }) => {
          if (!override) {
            return (
              <ContentCell
                emptyLabel={emptyLabel}
                missingLabel={missingLabel}
                row={row}
                spec={spec}
                statusLabels={statusLabels}
              />
            );
          }

          // Rendered as an element, not called as a function: an override is a
          // client component, and invoking one directly from this server
          // component would run its hooks on the server.
          const Cell = override.cell;

          return <Cell row={row as never} />;
        },
      };
    }),
    {
      id: "actions",
      header: "",
      align: "right",
      // Edit and the overflow menu are always there; publication adds the one
      // more. Written as a lookup rather than a template string, because Tailwind
      // can only see class names it can read in the source.
      className: ACTION_WIDTHS[definition.publication.enabled ? 1 : 0],
      cell: ({ row }) => {
        const title = titleOf(row);

        return (
          <>
            {definition.publication.enabled ? (
              <PublishContentAction
                contentTypeId={definition.id}
                id={row.id}
                permissionModule={definition.permissionModule}
                pluginId={pluginId}
                singular={definition.admin.label.singular}
                status={row.status}
                title={title}
              />
            ) : null}
            <EditContentAction
              data={row}
              fieldOverrides={Object.fromEntries(
                Object.entries(registration.fields ?? {}).map(
                  ([name, override]) => [name, override.component],
                ),
              )}
              // Page mode turns the pencil into a link. Nothing of the form is
              // mounted, so a 25-row table stays 25 anchors.
              href={
                definition.admin.edit.mode === "page"
                  ? contentEditHref(definition.id, row.id)
                  : undefined
              }
              permissionModule={definition.permissionModule}
              pluginId={pluginId}
              publication={definition.publication.enabled}
              singular={definition.admin.label.singular}
              spec={formSpec}
              title={title}
            />
            {/* Last in the cell, and every remaining action is inside it -
                including delete, which is the one thing here that cannot be
                undone and has no business sitting next to the pencil. */}
            <ContentRowActionsMenu
              contentTypeId={definition.id}
              currentVersion={typeof row.version === "number" ? row.version : 1}
              defaultLocale={definition.localization.defaultLocale}
              delivery={definition.delivery.enabled}
              editorial={definition.editorial.enabled}
              id={row.id}
              locale={localized ? locale : undefined}
              localized={localized}
              permissionModule={definition.permissionModule}
              pluginId={pluginId}
              preview={definition.editorial.preview.enabled}
              publication={definition.publication.enabled}
              scheduling={definition.editorial.scheduling.enabled}
              singular={definition.admin.label.singular}
              spec={formSpec}
              title={title}
              // The precondition the delete route checks. Taken from the row the
              // person is actually looking at, so a stale table cannot remove a
              // newer record.
              version={
                definition.editorial.enabled && typeof row.version === "number"
                  ? row.version
                  : undefined
              }
            />
          </>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      customNoResults={{
        description: t("empty.desc"),
        title: t("empty.title"),
      }}
      edges={data.edges}
      id={`content-${definition.id}`}
      order={{
        // The same allowlist the generated route builds its `orderBy` enum
        // from, so a header the backend would accept is never left unsortable.
        // `admin.list.orderableFields` alone would leave out `id`, `createdAt`,
        // `updatedAt` and - when publication is on - `status` and
        // `publishedAt`, all of which the API has always allowed. A localized
        // column is deliberately absent: it is one column on the *translation*
        // table, and a list ordered by it would reshuffle per language and make
        // a cursor mean two positions at once.
        columns: orderableColumns(definition),
        defaultOrder: {
          column: definition.admin.list.defaultOrderBy,
          order: definition.admin.list.defaultOrder,
        },
      }}
      pageInfo={data.pageInfo}
      search={definition.admin.list.searchableFields.length > 0}
    />
  );
};
