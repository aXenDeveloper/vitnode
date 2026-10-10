import { createFileRoute, redirect } from '@tanstack/react-router'
import { pageHead } from '@vitnode/core/tanstack/metadata'
import { Suspense } from 'react'

import { DocsError, DocsNotFound } from '@/docs/error-views'
import { DocsPageContent } from '@/docs/page-content'
import { DocsPagePendingSkeleton } from '@/docs/pending'
import { movedDocsPath } from '@/docs/redirects'
import { DOCS_STALE_TIME } from '@/docs/shared'
import { getDocsPage } from '@/docs/transport'

export const Route = createFileRoute('/_docs/docs/$')({
  beforeLoad: ({ params }) => {
    const moved = movedDocsPath(params._splat ?? '')

    if (moved) {
      // oxlint-disable-next-line typescript/only-throw-error
      throw redirect({
        params: { _splat: moved },
        statusCode: 301,
        to: '/docs/$',
      })
    }
  },
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
