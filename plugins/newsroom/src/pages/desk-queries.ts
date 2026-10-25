import type { RouteLoadContext } from "@vitnode/core/tanstack/plugin-routes";

import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import { RECORD_STALE_TIME } from "@vitnode/core/lib/query-freshness";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { manifest } from "@/manifest.gen";

import { fetchDesks } from "./desks-data";

type QueryClient = RouteLoadContext["queryClient"];

/**
 * Desks are AdminCP-managed containers, so they get a record's freshness and
 * are shared across pages: the desks index, the "new letter" picker and a
 * desk page all read the same entries. A letter page and a desk's list
 * read the API directly; the `/letters` list is cached in
 * `letter-list.ts`, and the create and edit pages expire it.
 */
const deskQueryKeys = {
  desk: (idOrSlug: string) => [manifest.id, "desk", idOrSlug] as const,
  desks: () => [manifest.id, "desks"] as const,
};

export const desksQueryOptions = () => ({
  meta: LOADER_DATA_QUERY_META,
  queryFn: fetchDesks,
  queryKey: deskQueryKeys.desks(),
  staleTime: RECORD_STALE_TIME,
});

const fetchDesk = async (idOrSlug: string) => {
  const res = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/desks",
    path: "/{idOrSlug}",
    args: { params: { idOrSlug: encodeURIComponent(idOrSlug) } },
  });

  if (res.status === 404) return null;
  if (res.status !== 200) throw new Error("Loading the desk failed.");

  return await res.json();
};

const deskQueryOptions = (idOrSlug: string) => ({
  meta: LOADER_DATA_QUERY_META,
  queryFn: async () => await fetchDesk(idOrSlug),
  queryKey: deskQueryKeys.desk(idOrSlug),
  // A miss is not cached, so a desk created a moment ago is found next time.
  staleTime: ({ state }: { state: { data: unknown } }) =>
    state.data ? RECORD_STALE_TIME : 0,
});

/**
 * The desk by id or slug, seeded under its other key as well - the desk page
 * asks by slug, a letter page by id. A slug made only of digits is skipped:
 * the route reads it as an id, so it would answer for a different desk.
 */
export const queryDesk = async (queryClient: QueryClient, idOrSlug: string) => {
  const data = await queryClient.query(deskQueryOptions(idOrSlug));
  if (!data) return data;

  const { id, slug } = data.container;
  // Through `query` with the data already in hand, so the copy is built from
  // the same options - `meta` included, which keeps it out of the SSR payload.
  // A fresh entry is left as it is; a stale one takes this newer copy.
  await Promise.all(
    [String(id), slug]
      .filter(key => key !== idOrSlug && !(key === slug && /^\d+$/.test(slug)))
      .map(
        async key =>
          await queryClient.query({
            ...deskQueryOptions(key),
            queryFn: () => data,
          }),
      ),
  );

  return data;
};

/** The desk's id from the cached desks list, when a page has already read it. */
export const cachedDeskId = (
  queryClient: QueryClient,
  slug: string,
): null | number =>
  queryClient
    .getQueryData<Awaited<ReturnType<typeof fetchDesks>>>(deskQueryKeys.desks())
    ?.find(desk => desk.slug === slug)?.id ?? null;
