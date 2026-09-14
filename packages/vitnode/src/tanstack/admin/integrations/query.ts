import type { QueryClient } from "@tanstack/react-query";

import { integrationsQueryKey } from "@/views/admin/views/core/system/integrations/integrations-query";

export const invalidateIntegrations = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: integrationsQueryKey });
