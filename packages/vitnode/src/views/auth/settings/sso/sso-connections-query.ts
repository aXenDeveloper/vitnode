import { queryOptions } from "@tanstack/react-query";

import type { SsoProfileField } from "@/lib/sso-profile";

import { CONFIG_PLUGIN } from "@/config";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";

export interface SsoConnection {
  accountLabel: null | string;
  connectedAt: Date | string;
  email: null | string;
  syncOnSignIn: boolean;
}

export interface SsoConnectionProvider {
  available: boolean;
  connection: null | SsoConnection;
  icon: null | string;
  id: string;
  name: string;
  profileFields: SsoProfileField[];
}

export interface SsoSignInSummary {
  hasPassword: boolean;
  passkeys: number;
  passkeysEnabled: boolean;
  passwordEnabled: boolean;
}

export type SsoProfileSources = Record<SsoProfileField, null | string>;

export interface SsoConnectionsApi {
  providers: SsoConnectionProvider[];
  signIn: SsoSignInSummary;
  sources: SsoProfileSources;
}

export interface SsoImportPreviewField {
  allowed: boolean;
  current: null | string;
  field: SsoProfileField;
  incoming: null | string;
  source: null | string;
}

export interface SsoImportPreviewApi {
  expiresAt: Date | string;
  fields: SsoImportPreviewField[];
}

export type SsoConnectionsFetcher = () => Promise<SsoConnectionsApi>;

export type SsoImportPreviewFetcher = (args: {
  providerId: string;
}) => Promise<null | SsoImportPreviewApi>;

const SSO_CONNECTIONS_REQUEST_ERROR = "SsoConnectionsRequestError";

export class SsoConnectionsRequestError extends Error {
  constructor(status: number) {
    super(`The SSO connections API answered ${status} for the current user.`);
    this.name = SSO_CONNECTIONS_REQUEST_ERROR;
    this.status = status;
  }

  readonly status: number;
}

export const isSsoConnectionsRequestError = (
  error: unknown,
): error is SsoConnectionsRequestError =>
  error instanceof Error && error.name === SSO_CONNECTIONS_REQUEST_ERROR;

export const fetchSsoConnections: SsoConnectionsFetcher = async () => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "users/sso/connections",
    path: "/",
  });

  if (response.status !== 200) {
    throw new SsoConnectionsRequestError(response.status);
  }

  return await response.json();
};

export const fetchSsoImportPreview: SsoImportPreviewFetcher = async ({
  providerId,
}) => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { providerId: encodeURIComponent(providerId) } },
    method: "get",
    module: "users/sso/connections",
    path: "/{providerId}/import",
  });

  if (response.status === 404) return null;
  if (response.status !== 200) {
    throw new SsoConnectionsRequestError(response.status);
  }

  return await response.json();
};

export const SSO_CONNECTIONS_IDENTITY_ROOT = [
  "sso-connections",
  "user",
] as const;

export const ssoConnectionsQueryKey = (userId: number) =>
  [...SSO_CONNECTIONS_IDENTITY_ROOT, userId] as const;

export const ssoImportPreviewQueryKey = (userId: number, providerId: string) =>
  [...ssoConnectionsQueryKey(userId), "import", providerId] as const;

export const ssoConnectionsQueryOptions = ({ userId }: { userId: number }) =>
  queryOptions({
    queryFn: async () => await fetchSsoConnections(),
    queryKey: ssoConnectionsQueryKey(userId),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

export const ssoImportPreviewQueryOptions = ({
  providerId,
  userId,
}: {
  providerId: string;
  userId: number;
}) =>
  queryOptions({
    queryFn: async () => await fetchSsoImportPreview({ providerId }),
    queryKey: ssoImportPreviewQueryKey(userId, providerId),
    retry: false,
    staleTime: 0,
  });
