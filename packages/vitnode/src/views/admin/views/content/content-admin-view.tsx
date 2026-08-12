import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import React from "react";

import type { RegisteredFrontendContentType } from "@/content/admin/config";
import type { ContentAdminRoute } from "@/content/admin/route";

import { I18nProvider } from "@/components/i18n-provider";
import { DataTableSkeleton } from "@/components/table/data-table";
import { HeaderContent } from "@/components/ui/header-content";
import { findFrontendContentType } from "@/content/admin/config";
import { contentI18nKeys, humanizeFieldName } from "@/content/admin/labels";
import { resolveContentAdminRoute } from "@/content/admin/route";
import {
  buildContentColumnSpec,
  buildContentFormSpec,
} from "@/content/admin/spec";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { contentCreateHref } from "@/content/registry";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";

import { CreateContentAction } from "./actions/create-action";
import { ContentCreatePageView, ContentEditPageView } from "./page/page-views";
import { ContentTableView } from "./table/content-table-view";

export interface ContentAdminViewProps {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Resolves what the catch-all slug was asking for: which content type, and
 * whether it wants the list, the create page or an edit page.
 *
 * Shared with `generateMetadata` and the breadcrumb slot, so all three agree
 * about a URL rather than each parsing it their own way.
 */
export const resolveContentRoute = async (
  params: ContentAdminViewProps["params"],
): Promise<
  (ContentAdminRoute & { entry: RegisteredFrontendContentType }) | undefined
> => {
  const { slug } = await params;
  const route = resolveContentAdminRoute(
    slug,
    contentTypeId => findFrontendContentType(contentTypeId)?.definition,
  );
  if (!route) return undefined;

  const entry = findFrontendContentType(route.contentTypeId);

  return entry ? { ...route, entry } : undefined;
};

/**
 * Resolves a registered content type from the catch-all slug, or `undefined`.
 *
 * Kept as its own export because that is what `generateMetadata` and the
 * breadcrumb slot in every app already call.
 */
export const resolveContentType = async (
  params: ContentAdminViewProps["params"],
): Promise<RegisteredFrontendContentType | undefined> =>
  (await resolveContentRoute(params))?.entry;

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

/**
 * The generated list screen.
 *
 * Split out from `ContentAdminView` so the dispatcher below reads as the three
 * screens it serves rather than as one function with a mode flag in it.
 */
const ContentListView = async ({
  entry,
  searchParams,
}: {
  entry: RegisteredFrontendContentType;
  searchParams: ContentAdminViewProps["searchParams"];
}) => {
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
    <div className="p-4">
      <HeaderContent desc={labels.desc} h1={labels.title}>
        {canCreate && (
          <CreateContentAction
            fieldOverrides={Object.fromEntries(
              Object.entries(registration.fields ?? {}).map(
                ([name, override]) => [name, override.component],
              ),
            )}
            // Page mode makes this a link. The dialog is not mounted at all,
            // so none of the form's chunks are downloaded until the page is.
            href={
              definition.admin.create.mode === "page"
                ? contentCreateHref(definition.id)
                : undefined
            }
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
  );
};

/**
 * One route, three screens.
 *
 * `/admin/content/blog/post` is the list, `.../create` and `.../42/edit` are the
 * generated form pages - and the last two exist only for a content type that
 * opted into `admin.create.mode` / `admin.edit.mode` of `page`, so nothing about
 * an existing content type moves.
 */
export const ContentAdminView = async ({
  params,
  searchParams,
}: ContentAdminViewProps) => {
  const route = await resolveContentRoute(params);
  if (!route) notFound();

  return (
    // The owning plugin's namespace travels with `core.content`, because a
    // plugin's overrides are client components that translate themselves: a
    // `forms.layout`, a field component and a column cell each call
    // `useTranslations("@vitnode/blog.…")`, and `I18nProvider` ships only the
    // namespaces it is handed. Without this every one of them is a
    // `MISSING_MESSAGE` the moment it renders - and the plugin id *is* the
    // top-level messages key, so there is nothing for an author to declare.
    <I18nProvider
      namespaces={["core.content"]}
      runtimeNamespaces={[route.entry.pluginId]}
    >
      {route.action === "list" ? (
        <ContentListView entry={route.entry} searchParams={searchParams} />
      ) : route.action === "create" ? (
        <ContentCreatePageView entry={route.entry} />
      ) : (
        <ContentEditPageView entry={route.entry} itemId={route.itemId ?? 0} />
      )}
    </I18nProvider>
  );
};
