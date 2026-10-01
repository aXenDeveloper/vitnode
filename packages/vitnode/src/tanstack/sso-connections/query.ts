import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type {
  ApplySsoImport,
  DiscardSsoImport,
  DisconnectSsoConnection,
  SaveSsoPreferences,
  StartSsoConnection,
} from "@/views/auth/settings/sso/sso-connections-mutations";

import {
  applySsoImportInBrowser,
  discardSsoImportInBrowser,
  disconnectSsoConnectionInBrowser,
  saveSsoPreferencesInBrowser,
  startSsoConnectionInBrowser,
} from "@/views/auth/settings/sso/sso-connections-mutations";
import { ssoConnectionsQueryKey } from "@/views/auth/settings/sso/sso-connections-query";
import { userProfileQueryKey } from "@/views/profile/profile-query";

import { invalidateSession } from "../auth/session-query";

export const invalidateSsoConnections = async (
  queryClient: QueryClient,
  userId: number,
): Promise<void> =>
  await queryClient.invalidateQueries({
    queryKey: ssoConnectionsQueryKey(userId),
  });

export interface SsoConnectionActions {
  onApplyImport: ApplySsoImport;
  onDiscardImport: DiscardSsoImport;
  onDisconnect: DisconnectSsoConnection;
  onSavePreferences: SaveSsoPreferences;
  onStart: StartSsoConnection;
}

export const createSsoConnectionActions = (
  queryClient: QueryClient,
  { nameCode, userId }: { nameCode: string; userId: number },
): SsoConnectionActions => ({
  onApplyImport: async args => {
    const result = await applySsoImportInBrowser(args);

    await Promise.all([
      invalidateSsoConnections(queryClient, userId),
      ...(result.ok
        ? [
            invalidateSession(queryClient),
            queryClient.invalidateQueries({
              queryKey: userProfileQueryKey(nameCode),
            }),
          ]
        : []),
    ]);

    return result;
  },
  onDiscardImport: async args => {
    await discardSsoImportInBrowser(args);
  },
  onDisconnect: async args => {
    const result = await disconnectSsoConnectionInBrowser(args);
    if (result.ok || result.failure === "not_connected") {
      await invalidateSsoConnections(queryClient, userId);
    }

    return result;
  },
  onSavePreferences: async args => {
    const result = await saveSsoPreferencesInBrowser(args);
    await invalidateSsoConnections(queryClient, userId);

    return result;
  },
  onStart: async args => {
    const result = await startSsoConnectionInBrowser(args);
    if (result.ok) {
      globalThis.location.assign(result.url);
    } else if (
      result.failure === "not_connected" ||
      result.failure === "provider_already_connected"
    ) {
      await invalidateSsoConnections(queryClient, userId);
    }

    return result;
  },
});

export const useSsoConnectionActions = ({
  nameCode,
  userId,
}: {
  nameCode: string;
  userId: number;
}): SsoConnectionActions => {
  const queryClient = useQueryClient();

  return React.useMemo(
    () => createSsoConnectionActions(queryClient, { nameCode, userId }),
    [nameCode, queryClient, userId],
  );
};
