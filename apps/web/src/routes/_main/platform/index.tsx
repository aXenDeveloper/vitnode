import { createFileRoute } from '@tanstack/react-router'

import { StaticBreadcrumb } from '@/site/marketing/breadcrumb'
import { MARKETING_PAGES, marketingHead } from '@/site/marketing/metadata'
import { PlatformIndexPage } from '@/site/platform/platform-page'

export const Route = createFileRoute('/_main/platform/')({
  head: () => marketingHead(MARKETING_PAGES.platform),
  staticData: { breadcrumb: <StaticBreadcrumb label="Platform" /> },
  component: PlatformIndexPage,
})
