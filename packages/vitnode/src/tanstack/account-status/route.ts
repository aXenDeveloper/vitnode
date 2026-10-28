import type { QueryClient } from "@tanstack/react-query";

import type { PluginRouteTranslator } from "@/routing";

import { accountStatusQueryOptions } from "@/views/moderation/warnings/warnings-api";

export const ACCOUNT_STATUS_NAMESPACES = [
  "core.global",
  "core.moderation",
] as const;

export interface AccountStatusRouteData {
  description: string;
  title: string;
}

export const loadAccountStatusRoute = async ({
  queryClient,
  t,
}: {
  queryClient: QueryClient;
  t: PluginRouteTranslator;
}): Promise<AccountStatusRouteData> => {
  await queryClient.query({
    ...accountStatusQueryOptions(),
    staleTime: "static",
  });

  return {
    description: t("core.moderation.account_status.desc"),
    title: t("core.moderation.account_status.title"),
  };
};
