import { createFileRoute } from '@tanstack/react-router'
import { intlQueryOptions } from '@vitnode/core/tanstack/i18n'

import { HomeRouteContent } from '@/site/home/home-content'
import { faqPageNode, homeHeadData } from '@/site/home/home-head'
import { HOME_NAMESPACES } from '@/site/home/namespaces'
import { MARKETING_PAGES, marketingHead } from '@/site/marketing/metadata'

export const Route = createFileRoute('/_main/')({
  loader: async ({ context }) => {
    const { messages } = await context.queryClient.query({
      ...intlQueryOptions({
        locale: context.locale,
        namespaces: HOME_NAMESPACES,
      }),
      staleTime: 'static',
    })

    return { ...homeHeadData(messages), locale: context.locale }
  },
  head: ({ loaderData }) =>
    marketingHead(
      {
        ...MARKETING_PAGES.home,
        description:
          loaderData?.description ?? MARKETING_PAGES.home.description,
        title: loaderData?.title ?? MARKETING_PAGES.home.title,
      },
      {
        extraNodes: loaderData?.faq.length ? [faqPageNode(loaderData.faq)] : [],
        locale: loaderData?.locale,
      },
    ),
  component: HomeRouteContent,
})
