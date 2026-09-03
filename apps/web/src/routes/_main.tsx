import { createFileRoute, Outlet } from '@tanstack/react-router'
import { MainBreadcrumb } from '@vitnode/core/tanstack/breadcrumb'
import {
  loadMainShell,
  ThemeLayoutContent,
} from '@vitnode/core/tanstack/layout'

import { MainHeader } from '#/components/main-header'

export const Route = createFileRoute('/_main')({
  loader: async ({ context }) => await loadMainShell(context),
  component: MainLayout,
})

function MainLayout() {
  return (
    <ThemeLayoutContent breadcrumb={<MainBreadcrumb />} header={<MainHeader />}>
      <Outlet />
    </ThemeLayoutContent>
  )
}
