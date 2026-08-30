import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import React from "react";

import type { RegisteredFrontendContentType } from "@/content/admin/config";
import type { ContentAdminRoute } from "@/content/admin/route";

import { I18nProvider } from "@/components/i18n-provider";
import { DataTableSkeleton } from "@/components/table/data-table";
import { HeaderContent } from "@/components/ui/header-content";
import { Skeleton } from "@/components/ui/skeleton";
import {
  findFrontendContentType,
  findFrontendContentTypeByAdminPath,
} from "@/content/admin/config";
import { type ContentLabelTranslator } from "@/content/admin/labels";
import { resolveContentAdminRoute } from "@/content/admin/route";
import {
  buildContentColumnSpec,
  buildContentFormSpec,
} from "@/content/admin/spec";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { contentCreateHref } from "@/content/registry";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";

import { CreateContentAction } from "./actions/create-action";
import { contentLabelsFrom } from "./content-labels";
import { NextContentFormHost } from "./form/host-next";
import { ContentCreatePageView, ContentEditPageView } from "./page/page-views";
import { ContentTableView } from "./table/content-table-view";

export interface ContentAdminViewProps {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const resolveContentRoute = async (
  params: ContentAdminViewProps["params"],
): Promise<
  (ContentAdminRoute & { entry: RegisteredFrontendContentType }) | undefined
> => {
  const { slug } = await params;
  const route = resolveContentAdminRoute(
    slug,
    adminPath => findFrontendContentTypeByAdminPath(adminPath)?.definition,
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
export const getContentLabels = async (entry: RegisteredFrontendContentType) =>
  // Cast once, here, where the translator enters: every key the resolver reads
  // is assembled from the content type id at runtime, which the generated key
  // union cannot describe. Nothing is read without `has` first.
  contentLabelsFrom(
    entry,
    (await getTranslations()) as unknown as ContentLabelTranslator,
  );

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
    labelSection: labels.labelSection,
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
            href={
              definition.admin.create.mode === "page"
                ? contentCreateHref(definition)
                : undefined
            }
            publication={definition.publication.enabled}
            singular={labels.singular}
            spec={formSpec}
          />
        )}
      </HeaderContent>

      <React.Suspense
        fallback={
          <DataTableSkeleton
            columns={columnSpecs.length + 1}
            toolbar={definition.admin.list.searchableFields.length > 0}
          />
        }
      >
        <ContentTableView
          columnSpecs={columnSpecs}
          entry={entry}
          formSpec={formSpec}
          searchParams={query}
          singular={labels.singular}
        />
      </React.Suspense>
    </div>
  );
};

export const ContentAdminView = async ({
  params,
  searchParams,
}: ContentAdminViewProps) => {
  const route = await resolveContentRoute(params);
  if (!route) notFound();

  return (
    <I18nProvider
      namespaces={["core.content"]}
      runtimeNamespaces={[route.entry.pluginId]}
    >
      {/*
       * Every content screen's mutations and navigation, mounted once.
       *
       * Here rather than in each of the three screens below because all three
       * need it and only one of them is on screen at a time: the list's create
       * button and its rows' edit dialogs open the same form the two page views
       * render, and a form is the thing that writes. `ContentAdminView` is the
       * one place all three meet, and the *only* module under `content/` that
       * still reaches Next.js from the client is the one it mounts.
       */}
      <NextContentFormHost>
        {route.action === "list" ? (
          <ContentListView entry={route.entry} searchParams={searchParams} />
        ) : route.action === "create" ? (
          <ContentCreatePageView entry={route.entry} />
        ) : (
          <ContentEditPageView entry={route.entry} itemId={route.itemId ?? 0} />
        )}
      </NextContentFormHost>
    </I18nProvider>
  );
};

export const ContentAdminViewSkeleton = () => (
  <div className="p-4">
    <HeaderContent
      desc={
        <span className="flex h-6 items-center">
          <Skeleton className="h-4 w-80 max-w-full" />
        </span>
      }
      h1={
        <span className="flex h-8 items-center sm:h-9">
          <Skeleton className="h-5 w-56 max-w-full sm:h-6" />
        </span>
      }
    >
      <Skeleton className="h-9 w-full sm:w-36" />
    </HeaderContent>

    <DataTableSkeleton columns={4} />
  </div>
);
