import { RouteMessages } from '@vitnode/core/tanstack/i18n'

import { findSolutionEntry } from './catalog'

export const SolutionsBreadcrumb = () => (
  <RouteMessages>
    <span>Solutions</span>
  </RouteMessages>
)

export const SolutionBreadcrumb = ({
  params,
}: {
  params: Readonly<Record<string, string>>
}) => {
  const solution = params.slug ? findSolutionEntry(params.slug) : undefined

  return (
    <RouteMessages>
      <span>{solution?.name ?? 'Solution'}</span>
    </RouteMessages>
  )
}
