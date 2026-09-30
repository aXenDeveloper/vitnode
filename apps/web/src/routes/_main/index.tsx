import { createFileRoute } from '@tanstack/react-router'
import { intlQueryOptions } from '@vitnode/core/tanstack/i18n'

import { HomeRouteContent } from '@/site/home/home-content'
import { HOME_NAMESPACES } from '@/site/home/namespaces'
import { MARKETING_PAGES, marketingHead } from '@/site/marketing/metadata'

export const Route = createFileRoute('/_main/')({
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...intlQueryOptions({
        locale: context.locale,
        namespaces: HOME_NAMESPACES,
      }),
      staleTime: 'static',
    })
  },
  head: () => marketingHead(MARKETING_PAGES.home),
  component: HomeRouteContent,
})
