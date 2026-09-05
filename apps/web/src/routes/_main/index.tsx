import { createFileRoute } from '@tanstack/react-router'
import { RouterLink } from '@vitnode/core/tanstack/layout'

import { pageHead } from '#/lib/page-head'
import { HomeRouteContent } from '#/site/home/home-content'
import { HOME_DESCRIPTION, HOME_TITLE } from '#/site/home/metadata'

export const Route = createFileRoute('/_main/')({
  head: () =>
    pageHead({
      description: HOME_DESCRIPTION,
      robots: 'index, follow',
      title: HOME_TITLE,
    }),
  component: HomeRoute,
})

function HomeRoute() {
  return <HomeRouteContent LinkComponent={RouterLink} />
}
