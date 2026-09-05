import { createFileRoute, Outlet } from '@tanstack/react-router'

import { DOCS_TREE_STALE_TIME } from '#/docs/freshness'
import { DocsShellPendingSkeleton } from '#/docs/pending'
import { DocsShellContent } from '#/docs/shell-content'
import { getDocsPageTree } from '#/docs/transport'

export const Route = createFileRoute('/_docs')({
  loader: async () => ({ pageTree: await getDocsPageTree() }),
  staleTime: DOCS_TREE_STALE_TIME,
  component: DocsShell,
  pendingComponent: DocsShellPendingSkeleton,
})

function DocsShell() {
  const { pageTree } = Route.useLoaderData()

  return (
    <DocsShellContent pageTree={pageTree}>
      <Outlet />
    </DocsShellContent>
  )
}
