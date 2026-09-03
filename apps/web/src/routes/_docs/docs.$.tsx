import { createFileRoute, redirect } from '@tanstack/react-router'

import { movedDocsSlug } from '#/docs/moved-pages'
import { DocsPageContent } from '#/docs/page-content'
import { getDocsPage } from '#/docs/transport'
import { pageHead } from '#/lib/page-head'

export const Route = createFileRoute('/_docs/docs/$')({
  beforeLoad: ({ params }) => {
    const moved = movedDocsSlug(params._splat ?? '')

    if (moved) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({
        params: { _splat: moved },
        statusCode: 301,
        to: '/docs/$',
      })
    }
  },
  loader: async ({ params }) => {
    const page = await getDocsPage({ data: params._splat ?? '' })
    const { docsClientLoader } = await import('#/docs/client-loader')

    await docsClientLoader.preload(page.path)

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
      robots: 'index, follow',
      title: loaderData?.metaTitle,
    }),
  component: DocsRoute,
})

function DocsRoute() {
  return <DocsPageContent {...Route.useLoaderData()} />
}
