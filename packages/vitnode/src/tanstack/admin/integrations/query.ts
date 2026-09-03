import type { QueryClient } from "@tanstack/react-query";

import { createIsomorphicFn } from "@tanstack/react-start";

import type { IntegrationsFetcher } from "@/views/admin/views/core/system/integrations/integrations-query";

import {
  fetchIntegrationsInBrowser,
  integrationsQueryKey,
  integrationsQueryOptions,
} from "@/views/admin/views/core/system/integrations/integrations-query";

import { fetchIntegrationsOnServer } from "./server";

const fetchIntegrations: IntegrationsFetcher = createIsomorphicFn()
  .server(fetchIntegrationsOnServer)
  .client(fetchIntegrationsInBrowser);

/** The board, as the one query definition the loader and the component share. */
export const integrationsQuery = () =>
  integrationsQueryOptions({ fetchIntegrations });

export const invalidateIntegrations = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: integrationsQueryKey });
