import { createFileRoute } from '@tanstack/react-router'

import { CompareIndexBreadcrumb } from '@/site/compare/breadcrumb'
import { CompareIndexPage } from '@/site/compare/compare-page'
import { MARKETING_PAGES, marketingHead } from '@/site/marketing/metadata'

export const Route = createFileRoute('/_main/compare/')({
  head: () => marketingHead(MARKETING_PAGES.compare),
  staticData: { breadcrumb: <CompareIndexBreadcrumb /> },
  component: CompareIndexPage,
})
