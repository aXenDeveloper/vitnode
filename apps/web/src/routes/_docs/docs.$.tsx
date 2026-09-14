import { createFileRoute } from '@tanstack/react-router'
import { pageHead } from '@vitnode/core/tanstack/metadata'
import { Suspense } from 'react'

import { DocsError, DocsNotFound } from '@/docs/error-views'
import { DocsPageContent } from '@/docs/page-content'
import { DocsPagePendingSkeleton } from '@/docs/pending'
import { DOCS_STALE_TIME } from '@/docs/shared'
import { getDocsPage } from '@/docs/transport'

export const Route = createFileRoute('/_docs/docs/$')({
  loader: async ({ params }) => {
    const page = await getDocsPage({ data: params._splat ?? '' })
    const { docs } = await import('@/docs/source')

    await docs.getPage(page.path)?.preload()

    return page
  },
  head: ({ loaderData }) =>
    pageHead({
      description: loaderData?.description,
      openGraph: {
        description: loaderData?.description,
        title: loaderData?.metaTitle,
        type: 'article',
      },
      robots: loaderData ? 'index, follow' : 'noindex, nofollow',
      title: loaderData?.metaTitle,
    }),
  staleTime: DOCS_STALE_TIME,
  component: DocsRoute,
  errorComponent: DocsError,
  notFoundComponent: DocsNotFound,
  pendingComponent: DocsPagePendingSkeleton,
})

function DocsRoute() {
  return (
    <Suspense fallback={<DocsPagePendingSkeleton />}>
      <DocsPageContent {...Route.useLoaderData()} />
    </Suspense>
  )
}
