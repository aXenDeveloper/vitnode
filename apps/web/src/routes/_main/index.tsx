import { createFileRoute } from '@tanstack/react-router'
import { RouterLink } from '@vitnode/core/tanstack/layout'

import { HomeRouteContent } from '#/site/home/home-content'
import { marketingHead } from '#/site/marketing/metadata'

const HomeRoute = () => <HomeRouteContent LinkComponent={RouterLink} />

export const Route = createFileRoute('/_main/')({
  head: () => marketingHead('home'),
  component: HomeRoute,
})
