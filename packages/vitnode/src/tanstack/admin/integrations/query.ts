import type { QueryClient } from "@tanstack/react-query";

import { createIsomorphicFn } from "@tanstack/react-start";

import type { IntegrationsFetcher } from "@/views/admin/views/core/system/integrations/integrations-query";

import {
  fetchIntegrationsInBrowser,
  integrationsQueryKey,
  integrationsQueryOptions,
} from "@/views/admin/views/core/system/integrations/integrations-query";

import { fetchIntegrationsOnServer } from "./server";

/**
 * The integrations board for a TanStack Start host: one query definition.
 *
 * The transport boundary is the same one every AdminCP read uses - both branches
 * call Hono directly, and the admin cookie travels on both. See
 * `tanstack/admin/cron/query.ts` for the full argument.
 */
const fetchIntegrations: IntegrationsFetcher = createIsomorphicFn()
  .server(fetchIntegrationsOnServer)
  .client(fetchIntegrationsInBrowser);

/** The board, as the one query definition the loader and the component share. */
export const integrationsQuery = () =>
  integrationsQueryOptions({ fetchIntegrations });

/**
 * Marks the board stale, so the next reader sees the current state.
 *
 * Nothing on this screen writes to it - the three test actions send an email,
 * upload a file and ask a model a question, none of which changes whether an
 * integration is *configured*. It is exported because an installation-level
 * mutation elsewhere legitimately does: configuring storage, adding an AI model,
 * or a cron run that clears the stale flag.
 */
export const invalidateIntegrations = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: integrationsQueryKey });
