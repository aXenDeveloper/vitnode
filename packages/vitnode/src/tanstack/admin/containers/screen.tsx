import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useTranslations } from "use-intl";

import type { ContentLabelTranslator } from "@/content/admin/labels";
import type { RegisteredFrontendContentContainer } from "@/content/admin/registry";
import type { ContentContainerSave } from "@/views/admin/views/containers/container-form-content";
import type { ContentContainerMutationResult } from "@/views/admin/views/containers/container-request";

import { contentContainerLabelsFrom } from "@/content/admin/containers";
import { ContentContainerManager } from "@/views/admin/views/containers/container-manager";
import { invalidateContentContainers } from "@/views/admin/views/containers/container-query";
import {
  contentContainerApiTarget,
  createContentContainer,
  deleteContentContainer,
  moveContentContainer,
  updateContentContainer,
} from "@/views/admin/views/containers/container-request";

import type { ContentContainerRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { contentContainerRouteQuery } from "./route";

export interface ContentContainerScreenProps extends ContentContainerRouteData {
  entry: RegisteredFrontendContentContainer;
}

const useContentContainerMutations = (
  entry: RegisteredFrontendContentContainer,
) => {
  const queryClient = useQueryClient();

  return React.useMemo(() => {
    const target = contentContainerApiTarget(entry);
    const settle = async (result: ContentContainerMutationResult<null>) => {
      if ("data" in result) {
        await invalidateContentContainers(queryClient, entry.definition.id);
      }

      return result;
    };

    const onSave: ContentContainerSave = async ({ body, id, parentId }) =>
      await settle(
        id === undefined
          ? await createContentContainer(target, {
              ...body,
              name: body.name ?? "",
              parentId: parentId ?? null,
            })
          : await updateContentContainer(target, id, body),
      );

    return {
      onDelete: async (id: number) =>
        await settle(await deleteContentContainer(target, id)),
      onMove: async ({
        id,
        ...move
      }: {
        id: number;
        parentId: null | number;
        position: number;
      }) => await settle(await moveContentContainer(target, id, move)),
      onSave,
    };
  }, [entry, queryClient]);
};

const ContentContainerScreenBody = ({
  entry,
}: {
  entry: RegisteredFrontendContentContainer;
}) => {
  const t = useTranslations();
  const query = useQuery(contentContainerRouteQuery(entry));
  const mutations = useContentContainerMutations(entry);
  const labels = contentContainerLabelsFrom(
    entry.definition,
    entry.pluginId,
    t as unknown as ContentLabelTranslator,
  );

  return (
    <ContentContainerManager
      definition={entry.definition}
      error={query.error}
      icon={entry.registration.icon}
      isPending={query.isPending}
      labels={labels}
      onRetry={() => {
        void query.refetch();
      }}
      pluginId={entry.pluginId}
      records={query.data}
      {...mutations}
    />
  );
};

export const ContentContainerScreenContent = ({
  entry,
  namespaces,
}: ContentContainerScreenProps) => (
  <RouteMessages namespaces={namespaces}>
    <div className="p-6">
      <ContentContainerScreenBody entry={entry} />
    </div>
  </RouteMessages>
);
