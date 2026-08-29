import { queryOptions } from "@tanstack/react-query";

import type { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";

import { fetcherClient } from "@/lib/fetcher-client";
import { adminModuleRef, AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

/**
 * Which of VitNode's integrations are configured and running, as one query
 * definition.
 *
 * One read of `GET /admin/debug/integrations`, which reports on nine
 * subsystems - AI, WebSocket, Redis, email, storage, cron, content preview, the
 * queue and captcha - each as a small object the board turns into a status.
 *
 * The route declares `adminStaffPermission: { module: "system", permission:
 * "can_view" }` and re-checks it on every request, so nothing below authorizes
 * anything.
 */

export const debugAdminModuleRef = adminModuleRef<typeof debugAdminModule>();

/** The debug module is mounted under `/admin`, not at the plugin root. */
export const ADMIN_DEBUG_PREFIX_PATH = "/admin";

/** One AI model the "test AI" dialog can be pointed at. */
export interface AdminIntegrationModel {
  id: string;
  name: string;
}

/**
 * The board's data, exactly as the route's `200` schema declares it.
 *
 * Declared rather than inferred off the fetcher, because the inferred type
 * cannot be named across a declaration-emit boundary. It stays honest anyway:
 * {@link fetchIntegrationsInBrowser} is typed as {@link IntegrationsFetcher} and
 * returns the response's own inferred shape, so a field renamed in
 * `integrationsDebugAdminRoute` stops this file compiling.
 */
export interface AdminIntegrations {
  ai: { active: boolean; models: AdminIntegrationModel[] };
  captcha: {
    active: boolean;
    type: "cloudflare_turnstile" | "recaptcha_v3" | null;
  };
  contentPreview: { active: boolean; contentTypes: number };
  cron: {
    active: boolean;
    jobs: number;
    lastRun: null | string;
    secure: boolean;
    stale: boolean;
  };
  email: { active: boolean };
  queue: {
    active: boolean;
    cronStale: boolean;
    pending: number;
    processing: number;
    tasks: number;
  };
  redis: { active: boolean; configuredButDown: boolean };
  storage: { active: boolean };
  websocket: { active: boolean; crossInstance: boolean };
}

/** The read, as arguments to whichever fetcher is carrying it. */
export const integrationsRequest = {
  method: "get" as const,
  module: "debug" as const,
  path: "/integrations" as const,
  prefixPath: ADMIN_DEBUG_PREFIX_PATH,
} as const;

/** How the board's data is actually fetched. */
export type IntegrationsFetcher = () => Promise<AdminIntegrations>;

/** The board's data, fetched from the browser. */
export const fetchIntegrationsInBrowser: IntegrationsFetcher = async () => {
  const response = await fetcherClient(
    debugAdminModuleRef,
    integrationsRequest,
  );

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the integrations board");
  }

  return await response.json();
};

/** The cache entry the board reads and writes. */
export const integrationsQueryKey = adminQueryRoot("integrations");

/**
 * The integrations board, as the one query definition every caller shares.
 *
 * `retry: false`, for the reason every AdminCP read refuses to retry: repeating
 * a `429` is the thing the rate limiter is asking the app to stop doing, and a
 * `403` is not going to become a `200` because we asked again.
 */
export const integrationsQueryOptions = ({
  fetchIntegrations = fetchIntegrationsInBrowser,
}: {
  fetchIntegrations?: IntegrationsFetcher;
} = {}) =>
  queryOptions({
    queryFn: async () => await fetchIntegrations(),
    queryKey: integrationsQueryKey,
    retry: false,
  });
