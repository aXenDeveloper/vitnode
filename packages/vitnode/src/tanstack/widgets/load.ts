import type { QueryClient } from "@tanstack/react-query";

import type { AnyEditablePageDefinition } from "@/content/editor";

import {
  moderatorPermissionsQueryOptions,
  pageLayoutQueryOptions,
} from "./query";

/**
 * Warms what {@link PageWidgets} renders from, so the zones are server-rendered
 * rather than filled in after hydration.
 *
 * The one line a route writes, because a zone never fetches and a loader is
 * where this framework reads: neither query rejects, so a widget area that
 * cannot be read costs the page it decorates nothing.
 */
export const loadPageWidgets = async (
  queryClient: QueryClient,
  page: AnyEditablePageDefinition,
): Promise<undefined> => {
  await Promise.all([
    queryClient.query({
      ...pageLayoutQueryOptions(page.id),
      staleTime: "static",
    }),
    queryClient.query({
      ...moderatorPermissionsQueryOptions(),
      staleTime: "static",
    }),
  ]);

  return undefined;
};
