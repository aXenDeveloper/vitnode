import { createFileRoute, notFound } from '@tanstack/react-router'

import { CompareBreadcrumb } from '@/site/compare/breadcrumb'
import { comparePageMeta, findCompareEntry } from '@/site/compare/catalog'
import { ComparePage } from '@/site/compare/compare-page'
import { findCompetitor } from '@/site/compare/data'
import { marketingHead } from '@/site/marketing/metadata'

const CompareRoute = () => {
  const { slug } = Route.useLoaderData()
  const competitor = findCompetitor(slug)

  if (!competitor) return null

  return <ComparePage competitor={competitor} />
}

const headFor = (slug: string) => {
  const entry = findCompareEntry(slug)

  return entry ? marketingHead(comparePageMeta(entry)) : {}
}

export const Route = createFileRoute('/_main/compare/$slug')({
  loader: ({ params }) => {
    // oxlint-disable-next-line typescript/only-throw-error
    if (!findCompareEntry(params.slug)) throw notFound()

    return { slug: params.slug }
  },
  head: ({ loaderData }) => (loaderData ? headFor(loaderData.slug) : {}),
  staticData: { breadcrumb: CompareBreadcrumb },
  component: CompareRoute,
})
