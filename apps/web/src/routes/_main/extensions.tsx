import { createFileRoute } from '@tanstack/react-router'

import { ExtensionsPage } from '@/site/extend/extend-pages'
import { StaticBreadcrumb } from '@/site/marketing/breadcrumb'
import { MARKETING_PAGES, marketingHead } from '@/site/marketing/metadata'

export const Route = createFileRoute('/_main/extensions')({
  head: () => marketingHead(MARKETING_PAGES.extensions),
  staticData: { breadcrumb: <StaticBreadcrumb label="Extension directory" /> },
  component: ExtensionsPage,
})
