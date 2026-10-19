import { RouteMessages } from '@vitnode/core/tanstack/i18n'

import { findPlatformEntry } from './catalog'

export const PlatformBreadcrumb = ({
  params,
}: {
  params: Readonly<Record<string, string>>
}) => {
  const entry = params.slug ? findPlatformEntry(params.slug) : undefined

  return (
    <RouteMessages>
      <span>{entry?.name ?? 'Platform'}</span>
    </RouteMessages>
  )
}
