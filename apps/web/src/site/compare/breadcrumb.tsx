import { RouteMessages } from '@vitnode/core/tanstack/i18n'

import { findCompareEntry } from './catalog'

export const CompareIndexBreadcrumb = () => (
  <RouteMessages>
    <span>Compare</span>
  </RouteMessages>
)

export const CompareBreadcrumb = ({
  params,
}: {
  params: Readonly<Record<string, string>>
}) => {
  const entry = params.slug ? findCompareEntry(params.slug) : undefined

  return (
    <RouteMessages>
      <span>{entry ? `VitNode vs ${entry.name}` : 'Comparison'}</span>
    </RouteMessages>
  )
}
