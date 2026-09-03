import type { QueryClient } from "@tanstack/react-query";

import { normalizeNamespaceList } from "@/routing";

import { intlQueryOptions } from "../i18n/query";

export const ADMIN_SHELL_NAMESPACES = ["core.global", "admin.global"] as const;

export const adminShellNamespaces = (
  navNamespaces: readonly string[] = [],
): string[] =>
  normalizeNamespaceList([...ADMIN_SHELL_NAMESPACES, ...navNamespaces]);

/** The narrowest slice of a route's context the admin loaders read. */
export interface AdminLoaderContext {
  locale: string;

  namespaces?: readonly string[];
  queryClient: QueryClient;
}

export const loadAdminMessages = async ({
  locale,
  namespaces,
  queryClient,
}: AdminLoaderContext): Promise<void> => {
  await queryClient.ensureQueryData(
    intlQueryOptions({
      locale,
      namespaces: adminShellNamespaces(namespaces),
    }),
  );
};
