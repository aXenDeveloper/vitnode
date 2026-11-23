import { createFileRoute, notFound } from '@tanstack/react-router'

import { marketingHead } from '@/site/marketing/metadata'
import { SolutionBreadcrumb } from '@/site/solutions/breadcrumb'
import { findSolutionEntry, solutionPageMeta } from '@/site/solutions/catalog'
import { findSolution } from '@/site/solutions/data'
import { SolutionPage } from '@/site/solutions/solution-page'

const SolutionRoute = () => {
  const { slug } = Route.useLoaderData()
  const solution = findSolution(slug)

  if (!solution) return null

  return <SolutionPage solution={solution} />
}

const headFor = (slug: string, locale: string) => {
  const solution = findSolutionEntry(slug)

  return solution ? marketingHead(solutionPageMeta(solution), { locale }) : {}
}

export const Route = createFileRoute('/_main/solutions/$slug')({
  loader: ({ context, params }) => {
    // oxlint-disable-next-line typescript/only-throw-error
    if (!findSolutionEntry(params.slug)) throw notFound()

    return { locale: context.locale, slug: params.slug }
  },
  head: ({ loaderData }) =>
    loaderData ? headFor(loaderData.slug, loaderData.locale) : {},
  staticData: { breadcrumb: SolutionBreadcrumb },
  component: SolutionRoute,
})
