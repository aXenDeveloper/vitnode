import { getTranslations } from "next-intl/server";
import { z } from "zod";

import type { ColumnDef } from "@/components/table/data-table";
import type { RegisteredFrontendContentType } from "@/content/admin/config";
import type { ContentColumnSpec, ContentFormSpec } from "@/content/admin/spec";

import { zodPaginationPageInfo } from "@/api/lib/with-pagination";
import { DataTable } from "@/components/table/data-table";
import { contentApiFetch } from "@/content/admin/fetch.server";
import { orderableColumns } from "@/content/registry";

import type { ContentRowData } from "./cells";

import { DeleteContentAction } from "../actions/delete-action";
import { EditContentAction } from "../actions/edit-action";
import { HistoryContentAction } from "../actions/history-action";
import { PreviewContentAction } from "../actions/preview-action";
import { PublishContentAction } from "../actions/publish-action";
import { ScheduleContentAction } from "../actions/schedule-action";
import { ContentCell } from "./cells";

const zodList = z.object({
  edges: z.array(
    z
      .object({
        id: z.number(),
        labels: z.record(z.string(), z.string().nullable()),
      })
      .loose(),
  ),
  pageInfo: zodPaginationPageInfo,
});

export const ContentTableView = async ({
  columnSpecs,
  entry,
  formSpec,
  translationSpec,
  searchParams,
}: {
  columnSpecs: ContentColumnSpec[];
  entry: RegisteredFrontendContentType;
  formSpec: ContentFormSpec;
  searchParams: Record<string, string | string[] | undefined>;
  /** Localized-field form spec, or `null` when the content type is not localized. */
  translationSpec: ContentFormSpec | null;
}) => {
  const t = await getTranslations("core.content");
  const { definition, pluginId, registration } = entry;

  const result = await contentApiFetch({
    definition,
    method: "get",
    pluginId,
    query: searchParams,
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
  const statusLabels = {
    draft: t("status.draft"),
    published: t("status.published"),
  };
  const titleField = definition.admin.titleField;

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
      // One column per button: publication adds a third, editorial a fourth,
      // preview a fifth and scheduling a sixth.
      className: [
        "w-20",
        definition.publication.enabled ? "w-28" : "",
        definition.editorial.enabled ? "w-36" : "",
        definition.editorial.preview.enabled ? "w-44" : "",
        definition.editorial.scheduling.enabled ? "w-52" : "",
      ]
        .filter(Boolean)
        .at(-1),
      cell: ({ row }) => {
        const title =
          titleField && typeof row[titleField] === "string"
            ? row[titleField]
            : `#${row.id}`;

        return (
          <>
            {definition.editorial.preview.enabled ? (
              <PreviewContentAction
                contentTypeId={definition.id}
                id={row.id}
                permissionModule={definition.permissionModule}
                pluginId={pluginId}
                title={title}
              />
            ) : null}
            {definition.editorial.scheduling.enabled ? (
              <ScheduleContentAction
                contentTypeId={definition.id}
                id={row.id}
                permissionModule={definition.permissionModule}
                pluginId={pluginId}
                singular={definition.admin.label.singular}
                title={title}
              />
            ) : null}
            {definition.editorial.enabled ? (
              <HistoryContentAction
                contentTypeId={definition.id}
                currentVersion={
                  typeof row.version === "number" ? row.version : 1
                }
                id={row.id}
                permissionModule={definition.permissionModule}
                pluginId={pluginId}
                singular={definition.admin.label.singular}
                spec={formSpec}
                title={title}
              />
            ) : null}
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
              defaultLocale={definition.localization.defaultLocale}
              editorial={definition.editorial.enabled}
              fieldOverrides={Object.fromEntries(
                Object.entries(registration.fields ?? {}).map(
                  ([name, override]) => [name, override.component],
                ),
              )}
              permissionModule={definition.permissionModule}
              pluginId={pluginId}
              publication={definition.publication.enabled}
              singular={definition.admin.label.singular}
              spec={formSpec}
              title={title}
              translationSpec={translationSpec}
            />
            <DeleteContentAction
              contentTypeId={definition.id}
              id={row.id}
              permissionModule={definition.permissionModule}
              pluginId={pluginId}
              singular={definition.admin.label.singular}
              title={title}
              // The precondition the delete route checks. Taken from the row
              // the person is actually looking at, so a stale table cannot
              // remove a newer record.
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
        // `publishedAt`, all of which the API has always allowed.
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
