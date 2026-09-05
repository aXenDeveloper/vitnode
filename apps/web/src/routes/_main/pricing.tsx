import { createFileRoute } from '@tanstack/react-router'

import { marketingHead } from '#/site/marketing/metadata'
import { PricingBreadcrumb, PricingPage } from '#/site/marketing/pricing'

export const Route = createFileRoute('/_main/pricing')({
  head: () => marketingHead('pricing'),
  staticData: { breadcrumb: <PricingBreadcrumb /> },
  component: PricingPage,
})
