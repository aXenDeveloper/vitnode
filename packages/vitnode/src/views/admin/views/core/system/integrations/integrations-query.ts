import { queryOptions } from "@tanstack/react-query";

import type { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";

import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { adminModuleRef, AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

export const debugAdminModuleRef = adminModuleRef<typeof debugAdminModule>();

/** The debug module is mounted under `/admin`, not at the plugin root. */
export const ADMIN_DEBUG_PREFIX_PATH = "/admin";

/** One AI model the "test AI" dialog can be pointed at. */
export interface AdminIntegrationModel {
  id: string;
  name: string;
}

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
/** How the board's data is actually fetched. */
export type IntegrationsFetcher = () => Promise<AdminIntegrations>;

/** The board's data, fetched from the browser. */
export const fetchIntegrationsInBrowser: IntegrationsFetcher = async () => {
  const response = await fetcherClient(debugAdminModuleRef, {
    method: "get",
    module: "debug",
    path: "/integrations",
    prefixPath: ADMIN_DEBUG_PREFIX_PATH,
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the integrations board");
  }

  return await response.json();
};

/** The cache entry the board reads and writes. */
export const integrationsQueryKey = adminQueryRoot("integrations");

export const integrationsQueryOptions = ({
  fetchIntegrations = fetchIntegrationsInBrowser,
}: {
  fetchIntegrations?: IntegrationsFetcher;
} = {}) =>
  queryOptions({
    queryFn: async () => await fetchIntegrations(),
    queryKey: integrationsQueryKey,
    retry: false,
    /** {@link RECORD_STALE_TIME} - An integration changes when an administrator configures it. */
    staleTime: RECORD_STALE_TIME,
  });
