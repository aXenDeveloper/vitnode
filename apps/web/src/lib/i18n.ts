import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'

import { loadShellIntl } from '#/server/messages.server'

/**
 * The shell's locale and its `core.global` strings, fetched on the server.
 *
 * A server function rather than a plain loader: the messages are read from JSON
 * inside each package's `dist`, which only exists on the server, and the plugin
 * registry they are merged from must never reach the browser bundle. Start
 * strips the handler - and everything only it imports - out of the client build.
 */
export const getShellIntl = createServerFn().handler(
  async () => await loadShellIntl(),
)

/**
 * The same request, as a query.
 *
 * Going through the QueryClient rather than returning it from the loader is what
 * makes the shell's copy of it *the* copy: the root loader warms it on the
 * server, the SSR integration dehydrates it into the HTML, and the component
 * reads it out of the hydrated cache instead of asking the server again. It is
 * also the first real exercise of the Stage 2 pipeline - router context, loader,
 * `ensureQueryData`, dehydrate, hydrate - which is worth having under something
 * the page visibly needs rather than a synthetic query.
 *
 * `staleTime: Infinity`: a locale's messages change when the app is redeployed.
 */
export const shellIntlQueryOptions = () =>
  queryOptions({
    queryFn: async () => await getShellIntl(),
    queryKey: ['vitnode', 'shell-intl'] as const,
    staleTime: Infinity,
  })
