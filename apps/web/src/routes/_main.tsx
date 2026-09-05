import { createFileRoute, Outlet } from '@tanstack/react-router'
import { MainBreadcrumb } from '@vitnode/core/tanstack/breadcrumb'
import {
  loadMainShell,
  ThemeLayoutContent,
} from '@vitnode/core/tanstack/layout'

import { MainFooter } from '#/components/main-footer'
import { MainHeader } from '#/components/main-header'

const MainLayout = () => {
  return (
    <div className="main-site">
      <ThemeLayoutContent
        breadcrumb={<MainBreadcrumb />}
        header={<MainHeader />}
      >
        <Outlet />
      </ThemeLayoutContent>
      <MainFooter />
    </div>
  )
}

export const Route = createFileRoute('/_main')({
  loader: async ({ context }) => await loadMainShell(context),
  head: () => ({
    meta: [{ name: 'theme-color', content: '#285ec8' }],
  }),
  component: MainLayout,
})
