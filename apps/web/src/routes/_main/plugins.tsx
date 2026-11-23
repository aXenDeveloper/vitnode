import { createFileRoute } from '@tanstack/react-router'

import {
  loadMarketingPageText,
  MARKETING_PAGES,
  marketingHead,
} from '@/site/marketing/metadata'
import { PluginsBreadcrumb } from '@/site/plugins/breadcrumb'
import { PluginsPage } from '@/site/plugins/plugins-page'

export const Route = createFileRoute('/_main/plugins')({
  loader: async ({ context }) => ({
    text: await loadMarketingPageText(context, 'plugins'),
  }),
  head: ({ loaderData }) =>
    marketingHead(MARKETING_PAGES.plugins, loaderData?.text),
  staticData: { breadcrumb: <PluginsBreadcrumb /> },
  component: PluginsPage,
})
