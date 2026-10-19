import { createFileRoute } from '@tanstack/react-router'

import { IntegrationsPage } from '@/site/extend/extend-pages'
import { StaticBreadcrumb } from '@/site/marketing/breadcrumb'
import { MARKETING_PAGES, marketingHead } from '@/site/marketing/metadata'

export const Route = createFileRoute('/_main/integrations')({
  head: () => marketingHead(MARKETING_PAGES.integrations),
  staticData: { breadcrumb: <StaticBreadcrumb label="Integrations" /> },
  component: IntegrationsPage,
})
