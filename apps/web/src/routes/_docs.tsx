import { createFileRoute, Outlet } from '@tanstack/react-router'
import { loadMainShell } from '@vitnode/core/tanstack/layout'

import docsCss from '@/docs/docs.css?url'
import { useDocsPageTree } from '@/docs/page-tree'
import { DocsShellPendingSkeleton } from '@/docs/pending'
import { DOCS_PENDING_MS, DOCS_STALE_TIME } from '@/docs/shared'
import { DocsShellContent } from '@/docs/shell-content'
import { DOCS_STYLESHEET_PRECEDENCE } from '@/docs/stylesheet'
import { getDocsPageTree } from '@/docs/transport'
import { withoutHmrTimestamp } from '@/lib/without-hmr-timestamp'

export const Route = createFileRoute('/_docs')({
  loader: async ({ context }) => {
    const [{ icons, pageTree }] = await Promise.all([
      getDocsPageTree(),
      loadMainShell(context),
    ])

    return { icons, pageTree }
  },
  head: () => ({
    links: [
      {
        href: withoutHmrTimestamp(docsCss),
        precedence: DOCS_STYLESHEET_PRECEDENCE,
        rel: 'stylesheet',
      },
    ],
  }),
  staleTime: DOCS_STALE_TIME,
  pendingMs: DOCS_PENDING_MS,
  component: DocsShell,
  pendingComponent: DocsShellPendingSkeleton,
})

function DocsShell() {
  const { icons, pageTree: serializedPageTree } = Route.useLoaderData()
  const pageTree = useDocsPageTree(serializedPageTree, icons)

  return (
    <DocsShellContent pageTree={pageTree}>
      <Outlet />
    </DocsShellContent>
  )
}
