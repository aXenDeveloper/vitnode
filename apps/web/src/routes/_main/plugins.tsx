import { createFileRoute } from '@tanstack/react-router'
import { RouterLink } from '@vitnode/core/tanstack/layout'

import { MARKETING_PAGES, marketingHead } from '#/site/marketing/metadata'
import { PluginsBreadcrumb, PluginsPage } from '#/site/plugins/plugins-page'

const PluginsRoute = () => <PluginsPage LinkComponent={RouterLink} />

export const Route = createFileRoute('/_main/plugins')({
  head: () => marketingHead(MARKETING_PAGES.plugins),
  staticData: { breadcrumb: <PluginsBreadcrumb /> },
  component: PluginsRoute,
})
