import { createFileRoute } from '@tanstack/react-router'

import {
  loadMarketingPageText,
  MARKETING_PAGES,
  marketingHead,
} from '@/site/marketing/metadata'
import { SolutionsBreadcrumb } from '@/site/solutions/breadcrumb'
import { SolutionsIndexPage } from '@/site/solutions/solution-page'

export const Route = createFileRoute('/_main/solutions/')({
  loader: async ({ context }) => ({
    text: await loadMarketingPageText(context, 'solutions'),
  }),
  head: ({ loaderData }) =>
    marketingHead(MARKETING_PAGES.solutions, loaderData?.text),
  staticData: { breadcrumb: <SolutionsBreadcrumb /> },
  component: SolutionsIndexPage,
})
