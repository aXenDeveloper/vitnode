import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import React from "react";

import type { RegisteredFrontendContentType } from "@/content/admin/config";

import { I18nProvider } from "@/components/i18n-provider";
import { DataTableSkeleton } from "@/components/table/data-table";
import { HeaderContent } from "@/components/ui/header-content";
import { findFrontendContentType } from "@/content/admin/config";
import { contentI18nKeys, humanizeFieldName } from "@/content/admin/labels";
import {
  buildContentColumnSpec,
  buildContentFormSpec,
} from "@/content/admin/spec";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { pathToContentTypeId } from "@/content/registry";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";

import { CreateContentAction } from "./actions/create-action";
import { ContentTableView } from "./table/content-table-view";

export interface ContentAdminViewProps {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Resolves a registered content type from the catch-all slug, or `undefined`.
 * Shared with `generateMetadata` and the breadcrumb slot.
 */
export const resolveContentType = async (
  params: ContentAdminViewProps["params"],
): Promise<RegisteredFrontendContentType | undefined> => {
  const { slug } = await params;

  return findFrontendContentType(pathToContentTypeId(slug));
};

/**
 * Resolves the display strings for a content type.
 *
 * Every key is optional: a plugin that translates nothing still gets readable
 * labels from the definition itself and from humanised field names.
 */
export const getContentLabels = async (
  entry: RegisteredFrontendContentType,
) => {
  const { definition, pluginId } = entry;
  const keys = contentI18nKeys(definition, pluginId);
  const t = await getTranslations();
  const has = (key: string): boolean =>
    t.has(key as Parameters<typeof t.has>[0]);
  const read = (key: string): string => t(key as Parameters<typeof t>[0]);

  return {
    desc: has(keys.desc) ? read(keys.desc) : undefined,
    labelEnum: (field: string, value: string) => {
      const key = keys.enumValue(field, value);

      return has(key) ? read(key) : humanizeFieldName(value);
    },
    labelField: (name: string) => {
      const key = keys.field(name);

      return has(key) ? read(key) : humanizeFieldName(name);
    },
    title: has(keys.title) ? read(keys.title) : definition.admin.label.plural,
  };
};

export const ContentAdminView = async ({
  params,
  searchParams,
}: ContentAdminViewProps) => {
  const entry = await resolveContentType(params);
  if (!entry) notFound();

  const { definition, pluginId, registration } = entry;

  const [labels, canView, canCreate, query] = await Promise.all([
    getContentLabels(entry),
    checkAdminPermissionApi({
      module: definition.permissionModule,
      permission: CONTENT_PERMISSIONS.view,
      plugin: pluginId,
    }),
    checkAdminPermissionApi({
      module: definition.permissionModule,
      permission: CONTENT_PERMISSIONS.create,
      plugin: pluginId,
    }),
    searchParams,
  ]);

  if (!canView) notFound();

  const formSpec = buildContentFormSpec({
    definition,
    labelEnum: labels.labelEnum,
    labelField: labels.labelField,
    pluginId,
  });
  const columnSpecs = buildContentColumnSpec({
    definition,
    labelEnum: labels.labelEnum,
    labelField: labels.labelField,
  });

  return (
    <I18nProvider namespaces={["core.content"]}>
      <div className="p-4">
        <HeaderContent desc={labels.desc} h1={labels.title}>
          {canCreate && (
            <CreateContentAction
              fieldOverrides={Object.fromEntries(
                Object.entries(registration.fields ?? {}).map(
                  ([name, override]) => [name, override.component],
                ),
              )}
              singular={definition.admin.label.singular}
              spec={formSpec}
            />
          )}
        </HeaderContent>

        <React.Suspense
          fallback={<DataTableSkeleton columns={columnSpecs.length + 1} />}
        >
          <ContentTableView
            columnSpecs={columnSpecs}
            entry={entry}
            formSpec={formSpec}
            searchParams={query}
          />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
};
