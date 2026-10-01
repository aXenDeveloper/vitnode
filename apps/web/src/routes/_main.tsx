import { createFileRoute, Outlet } from '@tanstack/react-router'
import { MainBreadcrumb } from '@vitnode/core/tanstack/breadcrumb'
import {
  loadMainShell,
  MainHeader,
  ThemeLayoutContent,
} from '@vitnode/core/tanstack/layout'

import { SiteFooter } from '@/site/marketing/footer'

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
  component: MainLayout,
})
