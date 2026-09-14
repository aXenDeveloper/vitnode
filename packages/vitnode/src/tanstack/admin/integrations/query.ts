import type { QueryClient } from "@tanstack/react-query";

import {
  integrationsQueryKey,
  integrationsQueryOptions,
} from "@/views/admin/views/core/system/integrations/integrations-query";

/** The board, as the one query definition the loader and the component share. */
export const integrationsQuery = () => integrationsQueryOptions();

export const invalidateIntegrations = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: integrationsQueryKey });
