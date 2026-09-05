import type { QueryClient } from "@tanstack/react-query";

import type { IntegrationsFetcher } from "@/views/admin/views/core/system/integrations/integrations-query";

import { fetcher } from "@/tanstack/fetcher";
import {
  integrationsFetcher,
  integrationsQueryKey,
  integrationsQueryOptions,
} from "@/views/admin/views/core/system/integrations/integrations-query";

const fetchIntegrations: IntegrationsFetcher = integrationsFetcher(fetcher);

/** The board, as the one query definition the loader and the component share. */
export const integrationsQuery = () =>
  integrationsQueryOptions({ fetchIntegrations });

export const invalidateIntegrations = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: integrationsQueryKey });
