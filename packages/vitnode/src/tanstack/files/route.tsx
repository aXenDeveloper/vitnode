import type { QueryClient } from "@tanstack/react-query";

import { createTranslator } from "use-intl";

import type { MyFilesParams } from "@/views/files/my-files-query";

import type { MyFilesRouteSearch } from "./route-search";

import { intlQueryOptions } from "../i18n/query";
import { myFilesQuery } from "./query";

/**
 * What `/files` renders strings from.
 *
 * `core.files` is the heading, the columns, the empty state and every word of
 * both delete dialogs. `core.global` is the rest of the table - the pager's
 * labels, the search placeholder, the confirm dialog's buttons and the error
 * toasts - and it is listed even though a root provider already provides it,
 * because `RouteMessages` mounts its own provider over the root's rather than
 * adding to it.
 *
 * One list, read by both the loader that fetches them and the provider that
 * mounts them, because they have to be the same set or the provider suspends on
 * a key nobody warmed.
 */
export const MY_FILES_NAMESPACES = ["core.files", "core.global"] as const;

/** The narrowest slice of a route's context this loader reads. */
export interface MyFilesLoaderContext {
  auth: { user: { id: number } };
  locale: string;
  queryClient: QueryClient;
}

/** What {@link loadMyFilesRoute} returns, and therefore what `head` receives. */
export interface MyFilesRouteData {
  description: string;
  params: MyFilesParams;
  title: string;
  userId: number;
}

/**
 * Both reads `/files` needs, in parallel, before it renders.
 *
 * `locale` comes from the root route's `beforeLoad`, which resolved it from the
 * public URL - so `/pl/files` fetches Polish messages, and the first byte of
 * HTML is already in that language.
 *
 * Neither call is repeated by the component: the messages are read back by
 * `RouteMessages` through the identical `intlQueryOptions`, and the page by
 * `useSuspenseQuery` through the identical `myFilesQuery`.
 *
 * The session is *not* fetched here. A host's `_authenticated` guard has already
 * put it in the one cache entry every guard reads, and `auth` is that guard's
 * own return - already narrowed to the signed-in half of the union, so
 * `auth.user` needs no check and this cannot disagree with the rule that
 * admitted the navigation.
 *
 * `userId` is read **once**, here, and returned; the component and the delete
 * callbacks take it from `loaderData` rather than reading it again, so there is
 * exactly one answer per render pass and no way for the loader to fill one cache
 * partition while the component reads another. It addresses a cache entry and
 * nothing else - `GET /users/files` takes no owner and derives one from the
 * session cookie on every request.
 *
 * A refusal from the files API is deliberately left to propagate. `401`, `403`
 * and `429` reject as `MyFilesRequestError`, which fails this loader and shows
 * the router's error path - the honest answer. The alternative, catching it and
 * rendering an empty table, is indistinguishable from an account with nothing
 * uploaded, which is the one thing this must never look like.
 *
 * See `loadDiscoverRoute` for why the messages are translated here rather than
 * in `head`, and why the message type is cast.
 */
export const loadMyFilesRoute = async ({
  auth,
  locale,
  params,
  queryClient,
}: MyFilesLoaderContext & {
  params: MyFilesParams;
}): Promise<MyFilesRouteData> => {
  const userId = auth.user.id;

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: MY_FILES_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...myFilesQuery({ params, userId }),
      revalidateIfStale: true,
    }),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      core: { files: { desc: string; title: string } };
    },
    namespace: "core.files",
  });

  return { description: t("desc"), params, title: t("title"), userId };
};

/**
 * How a table control changes the URL - the one thing the shared table cannot
 * decide for itself.
 *
 * `DataTable` mounts this for Next.js (`NextDataTableNavigation`, a locale-aware
 * `push`); a TanStack route mounts it with its own router's navigate.
 * Everything either side of it - which parameter a sort header rewrites, which
 * ones a filter resets, what a page button does with a cursor - is
 * `components/table/url-state.ts` and is shared.
 *
 * `to` is deliberately absent from the host's navigate: with no destination the
 * router stays on this route and changes only its search, which is the whole of
 * what a table control does. The promise is returned rather than dropped so the
 * seam's `useTransition` stays pending for the whole navigation, which is what
 * keeps the current rows on screen with a spinner instead of blanking the table.
 */
export type MyFilesNavigate = (options: {
  resetScroll: boolean;
  search: MyFilesRouteSearch;
}) => Promise<void>;
