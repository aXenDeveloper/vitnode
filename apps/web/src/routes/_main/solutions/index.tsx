import { createFileRoute } from '@tanstack/react-router'
import { RouterLink } from '@vitnode/core/tanstack/layout'

import { MARKETING_PAGES, marketingHead } from '#/site/marketing/metadata'
import {
  SolutionsBreadcrumb,
  SolutionsIndexPage,
} from '#/site/solutions/solution-page'

const SolutionsRoute = () => <SolutionsIndexPage LinkComponent={RouterLink} />

export const Route = createFileRoute('/_main/solutions/')({
  head: () => marketingHead(MARKETING_PAGES.solutions),
  staticData: { breadcrumb: <SolutionsBreadcrumb /> },
  component: SolutionsRoute,
})
