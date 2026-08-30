import { getLocale, getTranslations } from "next-intl/server";

import type { RegisteredFrontendContentType } from "@/content/admin/config";
import type { ContentColumnSpec, ContentFormSpec } from "@/content/admin/spec";

import { DataTable } from "@/components/table/data-table";
import { contentApiFetch } from "@/content/admin/fetch.server";
import { contentEditHref } from "@/content/registry";

import type { ContentRowData } from "./cells";

import { EditContentAction } from "../actions/edit-action";
import { PublishContentAction } from "../actions/publish-action";
import { ContentRowActionsMenu } from "../actions/row-actions-menu";
import {
  buildContentTableColumns,
  contentRowTitle,
  contentTableOrder,
  contentTableSearchEnabled,
} from "./columns";
import { zodContentListPage } from "./list-query";

/**
 * The Content Engine list, as Next.js renders it.
 *
 * A Server Component that fetches, then hands the answer to the shared column
 * model. Everything about *what the table is* - which columns exist, which cell
 * a plugin replaced, how a row is named, which columns sort - is `./columns`,
 * shared with the TanStack Start screen. What stays here is the half that is
 * genuinely Next's: `getTranslations`/`getLocale` from the request scope, the
 * server fetch, and the row actions, which end in Server Actions.
 */
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
    schema: zodContentListPage,
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

  const columns = buildContentTableColumns({
    columnSpecs,
    labels: {
      empty: t("table.empty_value"),
      missing: t("translations.states.missing"),
      status: { draft: t("status.draft"), published: t("status.published") },
    },
    registration,
    renderRowActions: (row: ContentRowData) => {
      const title = contentRowTitle(definition, row);

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
                ? contentEditHref(definition, row.id)
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
  });

  return (
    <DataTable
      columns={columns}
      customNoResults={{
        description: t("empty.desc"),
        title: t("empty.title"),
      }}
      edges={data.edges}
      id={`content-${definition.id}`}
      order={contentTableOrder(definition)}
      pageInfo={data.pageInfo}
      search={contentTableSearchEnabled(definition)}
    />
  );
};
