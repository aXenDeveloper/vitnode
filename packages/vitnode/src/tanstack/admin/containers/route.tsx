import { notFound } from "@tanstack/react-router";
import { createTranslator } from "use-intl";

import type { ContentLabelTranslator } from "@/content/admin/labels";
import type {
  ContentFrontendRegistry,
  RegisteredFrontendContentContainer,
} from "@/content/admin/registry";

import { contentContainerLabelsFrom } from "@/content/admin/containers";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { contentContainerListQuery } from "@/views/admin/views/containers/container-query";
import { contentContainerApiTarget } from "@/views/admin/views/containers/container-request";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { requireAdminPermission } from "../screen";

export const ADMIN_CONTAINERS_NAMESPACES = [
  "core.global",
  "core.containers",
] as const;

/** The strings a collection's screen and breadcrumb render with. */
export const contentContainerRouteNamespaces = (pluginId: string): string[] => [
  ...ADMIN_CONTAINERS_NAMESPACES,
  pluginId,
];

/** The query one collection's tree is read through. */
export const contentContainerRouteQuery = (
  entry: Pick<RegisteredFrontendContentContainer, "definition" | "pluginId">,
) =>
  contentContainerListQuery({
    definitionId: entry.definition.id,
    target: contentContainerApiTarget(entry),
  });

/** What the loader returns - serialisable, so no definition and no icon. */
export interface ContentContainerRouteData {
  adminPath: string;
  definitionId: string;
  description: string | undefined;
  labels: { plural: string; singular: string; title: string };
  namespaces: string[];
  pluginId: string;
  title: string;
}

export const loadContentContainerRoute = async ({
  adminAccess,
  locale,
  queryClient,
  registry,
  segments,
}: AdminScreenContext & {
  registry: ContentFrontendRegistry;
  segments: readonly string[];
}): Promise<ContentContainerRouteData> => {
  const entry = registry.containers.byAdminPath(segments.join("/"));

  if (!entry) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw notFound();
  }

  requireAdminPermission(adminAccess, {
    module: entry.definition.admin.permissionModule,
    permission: CONTENT_PERMISSIONS.view,
    plugin: entry.pluginId,
  });

  const namespaces = contentContainerRouteNamespaces(entry.pluginId);

  const [intl] = await Promise.all([
    queryClient.query({
      ...intlQueryOptions({ locale, namespaces }),
      staleTime: "static",
    }),
    // A failed read is the screen's to show - with a retry - rather than the
    // route's error boundary.
    queryClient
      .query({ ...contentContainerRouteQuery(entry), staleTime: "static" })
      .catch(() => undefined),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages,
    // Every collection key is optional; a missing one falls back to a name
    // derived from the definition id, so an absent translation is not an error.
    onError: () => undefined,
  }) as unknown as ContentLabelTranslator;

  const labels = contentContainerLabelsFrom(
    entry.definition,
    entry.pluginId,
    t,
  );

  return {
    adminPath: entry.definition.admin.path,
    definitionId: entry.definition.id,
    description: labels.desc,
    labels: {
      plural: labels.plural,
      singular: labels.singular,
      title: labels.title,
    },
    namespaces,
    pluginId: entry.pluginId,
    title: labels.title,
  };
};
