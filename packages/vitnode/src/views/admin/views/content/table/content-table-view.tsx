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

const ACTION_WIDTH = "w-0 whitespace-nowrap";

const zodList = z.object({
  edges: z.array(
    z
      .object({
        id: z.number(),
        labels: z.record(z.string(), z.string().nullable()),
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
  singular,
}: {
  columnSpecs: ContentColumnSpec[];
  entry: RegisteredFrontendContentType;
  formSpec: ContentFormSpec;
  searchParams: Record<string, string | string[] | undefined>;
  singular: string;
}) => {
  const [t, locale] = await Promise.all([
    getTranslations("core.content"),
    getLocale(),
  ]);
  const { definition, pluginId, registration } = entry;
  const localized = definition.localization.enabled;

  const result = await contentApiFetch({
    definition,
    method: "get",
    pluginId,
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

          const Cell = override.cell;

          return <Cell row={row as never} />;
        },
      };
    }),
    {
      id: "actions",
      header: "",
      align: "right",
      className: ACTION_WIDTH,
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
                singular={singular}
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

              href={
                definition.admin.edit.mode === "page"
                  ? contentEditHref(definition.id, row.id)
                  : undefined
              }
              permissionModule={definition.permissionModule}
              pluginId={pluginId}
              publication={definition.publication.enabled}
              singular={singular}
              spec={formSpec}
              title={title}
            />

            <ContentRowActionsMenu
              contentTypeId={definition.id}
              currentVersion={typeof row.version === "number" ? row.version : 1}
              delivery={definition.delivery.enabled}
              editorial={definition.editorial.enabled}
              id={row.id}
              locale={localized ? locale : undefined}
              permissionModule={definition.permissionModule}
              pluginId={pluginId}
              preview={definition.editorial.preview.enabled}
              scheduling={definition.editorial.scheduling.enabled}
              singular={singular}
              spec={formSpec}
              title={title}
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
