import { createFileRoute } from '@tanstack/react-router'

import { StaticBreadcrumb } from '@/site/marketing/breadcrumb'
import { MARKETING_PAGES, marketingHead } from '@/site/marketing/metadata'
import { WHY_VITNODE } from '@/site/platform/data'
import { PlatformPage } from '@/site/platform/platform-page'

const WhyVitNodeRoute = () => (
  <PlatformPage current="/why-vitnode" page={WHY_VITNODE} />
)

export const Route = createFileRoute('/_main/why-vitnode')({
  head: () => marketingHead(MARKETING_PAGES.whyVitnode),
  staticData: { breadcrumb: <StaticBreadcrumb label="Why VitNode" /> },
  component: WhyVitNodeRoute,
})
