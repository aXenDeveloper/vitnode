import type { RouteLoadContext } from "@vitnode/core/tanstack/plugin-routes";

import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import { RECORD_STALE_TIME } from "@vitnode/core/lib/query-freshness";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { manifest } from "@/manifest.gen";

import { fetchBoards } from "./boards-data";

type QueryClient = RouteLoadContext["queryClient"];

/**
 * Boards are AdminCP-managed containers, so they get a record's freshness and
 * are shared across pages: the boards index, the "new discussion" picker and a
 * board page all read the same entries. Discussions are left uncached on
 * purpose - this plugin's members edit them from pages that cannot reach the
 * query client to expire them, and a cached copy would show the old text right
 * after "Your changes are live".
 */
const exampleQueryKeys = {
  board: (idOrSlug: string) => [manifest.id, "board", idOrSlug] as const,
  boards: () => [manifest.id, "boards"] as const,
};

export const boardsQueryOptions = () => ({
  meta: LOADER_DATA_QUERY_META,
  queryFn: fetchBoards,
  queryKey: exampleQueryKeys.boards(),
  staleTime: RECORD_STALE_TIME,
});

const fetchBoard = async (idOrSlug: string) => {
  const res = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/boards",
    path: "/{idOrSlug}",
    args: { params: { idOrSlug: encodeURIComponent(idOrSlug) } },
  });

  if (res.status === 404) return null;
  if (res.status !== 200) throw new Error("Loading the board failed.");

  return await res.json();
};

const boardQueryOptions = (idOrSlug: string) => ({
  meta: LOADER_DATA_QUERY_META,
  queryFn: async () => await fetchBoard(idOrSlug),
  queryKey: exampleQueryKeys.board(idOrSlug),
  // A miss is not cached, so a board created a moment ago is found next time.
  staleTime: ({ state }: { state: { data: unknown } }) =>
    state.data ? RECORD_STALE_TIME : 0,
});

/**
 * The board by id or slug, seeded under its other key as well - the board page
 * asks by slug, a discussion page by id. A slug made only of digits is skipped:
 * the route reads it as an id, so it would answer for a different board.
 */
export const queryBoard = async (
  queryClient: QueryClient,
  idOrSlug: string,
) => {
  const data = await queryClient.query(boardQueryOptions(idOrSlug));
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
            ...boardQueryOptions(key),
            queryFn: () => data,
          }),
      ),
  );

  return data;
};

/** The board's id from the cached boards list, when a page has already read it. */
export const cachedBoardId = (
  queryClient: QueryClient,
  slug: string,
): null | number =>
  queryClient
    .getQueryData<Awaited<ReturnType<typeof fetchBoards>>>(
      exampleQueryKeys.boards(),
    )
    ?.find(board => board.slug === slug)?.id ?? null;
