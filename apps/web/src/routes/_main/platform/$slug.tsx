import { createFileRoute, notFound } from '@tanstack/react-router'

import { marketingHead } from '@/site/marketing/metadata'
import { PlatformBreadcrumb } from '@/site/platform/breadcrumb'
import {
  findPlatformEntry,
  platformPageMeta,
  platformPath,
} from '@/site/platform/catalog'
import { PLATFORM_PAGES } from '@/site/platform/data'
import { PlatformPage } from '@/site/platform/platform-page'

const PlatformRoute = () => {
  const { slug } = Route.useLoaderData()

  return (
    <PlatformPage current={platformPath(slug)} page={PLATFORM_PAGES[slug]} />
  )
}

export const Route = createFileRoute('/_main/platform/$slug')({
  loader: ({ params }) => {
    const entry = findPlatformEntry(params.slug)
    // oxlint-disable-next-line typescript/only-throw-error
    if (!entry) throw notFound()

    return { slug: entry.slug }
  },
  head: ({ loaderData }) => {
    const entry = loaderData ? findPlatformEntry(loaderData.slug) : undefined

    return entry ? marketingHead(platformPageMeta(entry)) : {}
  },
  staticData: { breadcrumb: PlatformBreadcrumb },
  component: PlatformRoute,
})
