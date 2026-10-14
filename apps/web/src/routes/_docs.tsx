import { createFileRoute, Outlet } from '@tanstack/react-router'
import { loadMainShell } from '@vitnode/core/tanstack/layout'
import { useFumadocsLoader } from 'fumadocs-core/source/client'

import docsCss from '@/docs/docs.css?url'
import { DocsShellPendingSkeleton } from '@/docs/pending'
import { DOCS_PENDING_MS, DOCS_STALE_TIME } from '@/docs/shared'
import { DocsShellContent } from '@/docs/shell-content'
import { getDocsPageTree } from '@/docs/transport'
import { withoutHmrTimestamp } from '@/lib/without-hmr-timestamp'

export const Route = createFileRoute('/_docs')({
  loader: async ({ context }) => {
    const [pageTree] = await Promise.all([
      getDocsPageTree(),
      loadMainShell(context),
    ])

    return { pageTree }
  },
  head: () => ({
    links: [{ href: withoutHmrTimestamp(docsCss), rel: 'stylesheet' }],
  }),
  staleTime: DOCS_STALE_TIME,
  pendingMs: DOCS_PENDING_MS,
  component: DocsShell,
  pendingComponent: DocsShellPendingSkeleton,
})

function DocsShell() {
  const { pageTree } = useFumadocsLoader(Route.useLoaderData())

  return (
    <DocsShellContent pageTree={pageTree}>
      <Outlet />
    </DocsShellContent>
  )
}
