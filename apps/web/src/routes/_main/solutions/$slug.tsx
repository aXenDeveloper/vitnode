import { createFileRoute, notFound } from '@tanstack/react-router'
import { RouterLink } from '@vitnode/core/tanstack/layout'

import { marketingHead } from '#/site/marketing/metadata'
import { SolutionBreadcrumb } from '#/site/solutions/breadcrumb'
import { findSolutionEntry, solutionPageMeta } from '#/site/solutions/catalog'
import { findSolution } from '#/site/solutions/data'
import { SolutionPage } from '#/site/solutions/solution-page'

const SolutionRoute = () => {
  const { slug } = Route.useLoaderData()
  const solution = findSolution(slug)

  if (!solution) return null

  return <SolutionPage LinkComponent={RouterLink} solution={solution} />
}

const headFor = (slug: string) => {
  const solution = findSolutionEntry(slug)

  return solution ? marketingHead(solutionPageMeta(solution)) : {}
}

export const Route = createFileRoute('/_main/solutions/$slug')({
  loader: ({ params }) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    if (!findSolutionEntry(params.slug)) throw notFound()

    return { slug: params.slug }
  },
  head: ({ loaderData }) => (loaderData ? headFor(loaderData.slug) : {}),
  staticData: { breadcrumb: SolutionBreadcrumb },
  component: SolutionRoute,
})
