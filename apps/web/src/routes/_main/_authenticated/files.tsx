import type { DataTableNavigation } from '@vitnode/core/components/table/navigation'

import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { DataTableNavigationProvider } from '@vitnode/core/components/table/navigation'
import { HeaderContent } from '@vitnode/core/components/ui/header-content'
import { formatPageTitle } from '@vitnode/core/lib/metadata'
import { MyFilesTableContent } from '@vitnode/core/views/files/my-files-table-content'
import React from 'react'
import { createTranslator } from 'use-intl'

import { RouteMessages } from '#/components/route-messages'
import { myFilesQuery, useMyFilesDeleteCallbacks } from '#/lib/files/my-files'
import {
  myFilesRouteParams,
  myFilesSearchFrom,
  myFilesSearchParams,
  normalizeMyFilesRouteSearch,
} from '#/lib/files/my-files-route'
import { intlQueryOptions } from '#/lib/i18n/query'
import { vitNodeShellConfig } from '#/vitnode.shell.config'

/**
 * The visitor's own files, rendered outside Next.js.
 *
 * One route file serving two public URLs. `/files` and `/pl/files` match *this*
 * route: the locale is stripped before matching and written back into every link
 * the router builds (`rewrite` in `src/router.tsx`), so nothing here mentions a
 * language and there is no `/pl/files.tsx` to keep in step. The Next.js route at
 * `packages/vitnode/src/routes/main/files/page.tsx` is still live and unchanged -
 * this is a parallel slice until the cutover.
 *
 * ## Where it sits, and what that buys
 *
 * Under `_authenticated`, which is a pathless layout: the file's *location* is
 * the guard, and this route contributes no URL segment of its own. There is
 * deliberately no session check in this file. The Next.js page opens with
 * `getSessionApi()` and `notFound()` because it has nowhere else to put the rule;
 * here that rule is `routes/_authenticated.tsx`, it runs in `beforeLoad` before
 * any of this renders, and it answers an anonymous visitor with
 * `/login?returnTo=/files` - carrying whatever sort and page they were heading
 * for, and no locale, because the rewrite writes that back on the way home.
 *
 * A second check here would not be defence in depth, it would be a second rule to
 * keep in step with the first. The actual boundary is neither: `GET
 * /api/@vitnode/core/users/files` derives the owner from the session cookie on
 * every request, which is why a session that ends while this page is open shows
 * up below as a failed query rather than as somebody else's files.
 *
 * ## One query contract, one cache entry
 *
 * The table is `myFilesQuery` and nothing else, in the loader and in the
 * component:
 *
 *     loader:     ensureQueryData(myFilesQuery({ params, userId }))
 *     component:  useSuspenseQuery(myFilesQuery({ params, userId }))
 *     after a delete: invalidate that visitor's family, and it refetches
 *
 * Same key, same request, same refusal handling - so the page the server rendered
 * is the page the browser reads, and there is no `initialData` anywhere: the
 * loader has already put it in the entry the component reads and the SSR pass
 * dehydrates it, so a second copy of those bytes could only disagree with the
 * first.
 *
 * `params` is the *normalised* request from `loaderDeps`, handed to the component
 * through the loader rather than derived a second time, so the two cannot drift
 * apart through a difference in how each computed it.
 *
 * ## Whose files, in the cache as well as at the API
 *
 * `userId` is handed through the same way and for a sharper reason. The browser's
 * `QueryClient` is created once per document and survives a sign-out, so a key of
 * `["files", "me", params]` is only unique for as long as "me" is: after A signs
 * out and B signs in, B's loader would `ensureQueryData` an entry A had already
 * filled, find it populated, make no request, and render A's file names. Hono
 * cannot refuse a request nobody sent.
 *
 * So the key carries the owner - `["files", "user", <id>, params]` - and the id
 * comes from `context.auth.user.id`, which is `_authenticated`'s own state from
 * the one canonical session query. It is read **once**, in the loader, and
 * returned; the component and the delete callbacks take it from `loaderData`
 * rather than reading it again, so there is exactly one answer per render pass
 * and no way for the loader to fill one partition while the component reads
 * another.
 *
 * It addresses a cache entry and nothing else. `GET /users/files` takes no owner
 * and derives one from the session cookie on every request, exactly as before -
 * see `myFilesQueryRoot` in `@vitnode/core`.
 */

/**
 * What this page renders strings from.
 *
 * `core.files` is the heading, the columns, the empty state and every word of
 * both delete dialogs. `core.global` is the rest of the table - the pager's
 * labels, the search placeholder, the confirm dialog's buttons and the error
 * toasts - and it is listed even though the root already provides it, because
 * `RouteMessages` mounts its own provider over the root's rather than adding to
 * it.
 *
 * One list, read by both the loader that fetches them and the provider that
 * mounts them, because they have to be the same set or the provider suspends on
 * a key nobody warmed.
 */
const FILES_NAMESPACES = ['core.files', 'core.global'] as const

export const Route = createFileRoute('/_main/_authenticated/files')({
  component: MyFilesRoute,
  /**
   * The request, as the only thing the loader re-runs for.
   *
   * The *normalised* parameters rather than the raw search, and that is what
   * makes this exact. The router hands `loaderDeps` the validated search merged
   * over everything else that was in the query string, so keying on it directly
   * would re-run the loader for a stray `?utm_source=` - and, worse, would treat
   * `?first=10` and no `first` as two different pages of the same rows.
   * Normalised, the dependency is precisely "which rows are being asked for",
   * which is also what the query key is built from.
   */
  loaderDeps: ({ search }) => ({ params: myFilesRouteParams(search) }),
  /**
   * Both reads this page needs, in parallel, before it renders.
   *
   * `context.locale` comes from the root route's `beforeLoad`, which resolved it
   * from the public URL - so `/pl/files` fetches Polish messages, and the first
   * byte of HTML is already in that language.
   *
   * Neither call is repeated by the component: the messages are read back by
   * `RouteMessages` through the identical `intlQueryOptions`, and the page by
   * `useSuspenseQuery` through the identical `myFilesQuery`.
   *
   * The session is *not* fetched here. `_authenticated`'s `beforeLoad` has
   * already put it in the one cache entry every guard reads.
   *
   * A refusal from the files API is deliberately left to propagate. `401`, `403`
   * and `429` reject as `MyFilesRequestError`, which fails this loader and shows
   * the router's error path - the honest answer. The alternative, catching it and
   * rendering an empty table, is indistinguishable from an account with nothing
   * uploaded, which is the one thing this must never look like.
   */
  loader: async ({ context, deps }) => {
    /*
      The visitor, from the guard that let this route load. `context.auth` is
      `_authenticated`'s `beforeLoad` return, already narrowed to the signed-in
      half of the union - so `auth.user` needs no check, and this cannot disagree
      with the rule that admitted the navigation.
    */
    const userId = context.auth.user.id

    const [intl] = await Promise.all([
      context.queryClient.ensureQueryData(
        intlQueryOptions({
          locale: context.locale,
          namespaces: FILES_NAMESPACES,
        }),
      ),
      context.queryClient.ensureQueryData(
        myFilesQuery({ params: deps.params, userId }),
      ),
    ])

    /**
     * The heading and the tab title, translated once so they cannot disagree.
     *
     * The cast is what makes `createTranslator` usable here, and it is the same
     * one `login.tsx` explains at length: its key type is derived from the
     * *inferred* type of `messages`, and `AbstractIntlMessages` is a bare index
     * signature - so `MessageKeys` cannot tell a leaf from a branch and collapses
     * to `never`, making every key a type error. Naming the two keys this route
     * reads is both the smallest fix and a true statement: rename either in
     * `core/locales/en.json` and this stops compiling rather than rendering a raw
     * message key into a `<title>`.
     */
    const t = createTranslator({
      locale: context.locale,
      messages: intl.messages as {
        core: { files: { desc: string; title: string } }
      },
      namespace: 'core.files',
    })

    return {
      description: t('desc'),
      params: deps.params,
      title: t('title'),
      userId,
    }
  },
  /**
   * The page's metadata, in the language the request resolved to.
   *
   * **`head` must be written after `loader`.** `loaderData`'s type is inferred
   * from `loader` in the same object literal, and TypeScript reads a literal's
   * members in order - put `head` first and `loaderData` is `never`, while
   * `Route.useLoaderData()` collapses to `undefined`. Neither error names the
   * cause.
   *
   * The loader translates once, so the tab title and the `<h1>` are the same
   * string by construction - which is what the Next.js route gets from calling
   * `getTranslations` once per request. `formatPageTitle` applies the same
   * `"<page> - <site>"` rule Next.js applies through `title.template`.
   */
  head: ({ loaderData }) => ({
    meta: [
      // The Next.js page sets `robots: { index: false, follow: false }`, and this
      // is that: a listing of one person's uploads, behind a login, with nothing
      // on it a crawler may see or follow. Stated rather than assumed - TanStack
      // Start emits no robots directive of its own.
      { content: 'noindex, nofollow', name: 'robots' },
      ...(loaderData
        ? [
            {
              title: formatPageTitle(
                vitNodeShellConfig.metadata,
                loaderData.title,
              ),
            },
            { content: loaderData.description, name: 'description' },
          ]
        : []),
    ],
  }),
  validateSearch: normalizeMyFilesRouteSearch,
})

function MyFilesRoute() {
  const { description, params, title, userId } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(myFilesQuery({ params, userId }))
  const { onDeleteFile, onDeleteFiles } = useMyFilesDeleteCallbacks(userId)

  /**
   * The one thing the shared table cannot decide for itself: how to change a URL.
   *
   * `DataTable` mounts this for Next.js (`NextDataTableNavigation`, a
   * locale-aware `push`); a TanStack route mounts it with the router's own
   * navigate. Everything either side of it - which parameter a sort header
   * rewrites, which ones a filter resets, what a page button does with a cursor -
   * is `components/table/url-state.ts` and is shared.
   *
   * `to` is deliberately absent: with no destination the router stays on this
   * route and changes only its search, which is the whole of what a table
   * control does. `resetScroll: false` is Next's `scroll: false` - somebody
   * sorting the last column of a long table is looking at the header they
   * clicked.
   *
   * The promise is returned rather than dropped so the seam's `useTransition`
   * stays pending for the whole navigation, which is what keeps the current rows
   * on screen with a spinner instead of blanking the table.
   */
  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async (nextSearch) => {
        await navigate({
          resetScroll: false,
          search: myFilesSearchFrom(nextSearch),
        })
      },
      searchParams: myFilesSearchParams(search),
    }),
    [navigate, search],
  )

  return (
    <RouteMessages namespaces={FILES_NAMESPACES}>
      <div className="container mx-auto flex flex-col gap-6 p-4">
        <HeaderContent desc={description} h1={title} />

        <DataTableNavigationProvider value={navigation}>
          {/*
            The same component the Next.js page renders, handed the three things a
            shared table cannot resolve for itself: the page, and the two deletes.
            The columns, the preview, the metadata popover and the empty state are
            core's and are not restated here - see `my-files-table-content.tsx`.

            Both callbacks end in a query invalidation of the whole `files/me`
            family rather than in `revalidatePath`, and only when something
            actually went: a `409` leaves the file where it was and the dialog
            open, and a bulk run that deleted nothing must not drop the selection
            that is showing which rows were kept. That rule is core's
            (`shouldRefreshAfterBulkDelete`) and is applied by
            `#/lib/files/my-files`, so both frameworks refresh on the same
            condition.
          */}
          <MyFilesTableContent
            data={data}
            onDeleteFile={onDeleteFile}
            onDeleteFiles={onDeleteFiles}
          />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  )
}
