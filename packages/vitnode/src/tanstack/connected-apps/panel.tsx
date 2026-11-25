import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useTranslations } from "use-intl";

import type { DisconnectConnectedApp } from "@/views/auth/settings/connected-apps/connection-item";

import { PageTitle } from "@/components/ui/page-title";
import { ConnectedAppsContent } from "@/views/auth/settings/connected-apps/connected-apps-content";
import {
  connectedAppsQueryKey,
  connectedAppsQueryOptions,
  disconnectConnectedApp,
} from "@/views/auth/settings/connected-apps/connected-apps-query";

const ConnectedAppsHeading = () => {
  const t = useTranslations("core.auth.settings.connected_apps");
  const tSettings = useTranslations("core.auth.settings");

  return (
    <PageTitle
      className="mb-0"
      desc={t("desc")}
      h1={t("title")}
      subtitle={tSettings("title")}
    />
  );
};

const useDisconnectConnectedApp = (userId: number): DisconnectConnectedApp => {
  const queryClient = useQueryClient();

  return React.useCallback(
    async (id: number) => {
      const isDone = await disconnectConnectedApp(id);
      if (isDone) {
        await queryClient.invalidateQueries({
          queryKey: connectedAppsQueryKey(userId),
        });
      }

      return isDone;
    },
    [queryClient, userId],
  );
};

export const ConnectedAppsPanelContent = ({
  endpoint,
  userId,
}: {
  endpoint: string;
  userId: number;
}) => {
  const query = useQuery(connectedAppsQueryOptions({ userId }));
  const onDisconnect = useDisconnectConnectedApp(userId);

  return (
    <>
      <ConnectedAppsHeading />
      <ConnectedAppsContent
        endpoint={endpoint}
        onDisconnect={onDisconnect}
        query={query}
      />
    </>
  );
};
