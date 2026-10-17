import { createFileRoute, Outlet } from '@tanstack/react-router'
import { MainBreadcrumb } from '@vitnode/core/tanstack/breadcrumb'
import {
  loadMainShell,
  MainHeader,
  ThemeLayoutContent,
} from '@vitnode/core/tanstack/layout'

import { withoutHmrTimestamp } from '@/lib/without-hmr-timestamp'
import { SiteFooter } from '@/site/marketing/footer'
import marketingCss from '@/site/marketing/marketing.css?url'

const MainLayout = () => (
  <>
    <ThemeLayoutContent breadcrumb={<MainBreadcrumb />} header={<MainHeader />}>
      <Outlet />
    </ThemeLayoutContent>
    <SiteFooter />
  </>
)

export const Route = createFileRoute('/_main')({
  loader: async ({ context }) => await loadMainShell(context),
  // Marketing-only keyframes and layouts stay out of the global stylesheet,
  // so admin and docs never download them.
  head: () => ({
    links: [{ href: withoutHmrTimestamp(marketingCss), rel: 'stylesheet' }],
  }),
  component: MainLayout,
})
