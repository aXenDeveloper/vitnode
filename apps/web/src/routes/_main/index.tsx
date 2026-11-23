import { createFileRoute } from '@tanstack/react-router'
import { intlQueryOptions } from '@vitnode/core/tanstack/i18n'

import { HomeRouteContent } from '@/site/home/home-content'
import { HOME_NAMESPACES } from '@/site/home/namespaces'
import {
  loadMarketingPageText,
  MARKETING_PAGES,
  marketingHead,
} from '@/site/marketing/metadata'

export const Route = createFileRoute('/_main/')({
  loader: async ({ context }) => {
    const [, text] = await Promise.all([
      context.queryClient.query({
        ...intlQueryOptions({
          locale: context.locale,
          namespaces: HOME_NAMESPACES,
        }),
        staleTime: 'static',
      }),
      loadMarketingPageText(context, 'home'),
    ])

    return { text }
  },
  head: ({ loaderData }) =>
    marketingHead(MARKETING_PAGES.home, loaderData?.text),
  component: HomeRouteContent,
})
