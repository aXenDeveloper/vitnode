import { getTranslations } from "next-intl/server";
import { z } from "zod";

import type { ColumnDef } from "@/components/table/data-table";
import type { RegisteredFrontendContentType } from "@/content/admin/config";
import type { ContentColumnSpec, ContentFormSpec } from "@/content/admin/spec";

import { zodPaginationPageInfo } from "@/api/lib/with-pagination";
import { DataTable } from "@/components/table/data-table";
import { contentApiFetch } from "@/content/admin/fetch.server";

import type { ContentRowData } from "./cells";

import { DeleteContentAction } from "../actions/delete-action";
import { EditContentAction } from "../actions/edit-action";
import { PublishContentAction } from "../actions/publish-action";
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
  searchParams,
}: {
  columnSpecs: ContentColumnSpec[];
  entry: RegisteredFrontendContentType;
  formSpec: ContentFormSpec;
  searchParams: Record<string, string | string[] | undefined>;
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
      // Room for the third button publication adds.
      className: definition.publication.enabled ? "w-28" : "w-20",
      cell: ({ row }) => {
        const title =
          titleField && typeof row[titleField] === "string"
            ? row[titleField]
            : `#${row.id}`;

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
              permissionModule={definition.permissionModule}
              pluginId={pluginId}
              publication={definition.publication.enabled}
              singular={definition.admin.label.singular}
              spec={formSpec}
              title={title}
            />
            <DeleteContentAction
              contentTypeId={definition.id}
              id={row.id}
              permissionModule={definition.permissionModule}
              pluginId={pluginId}
              singular={definition.admin.label.singular}
              title={title}
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
        columns: definition.admin.list.orderableFields,
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
