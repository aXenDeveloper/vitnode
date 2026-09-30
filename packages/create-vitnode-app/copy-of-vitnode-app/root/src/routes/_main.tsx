import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MainBreadcrumb } from "@vitnode/core/tanstack/breadcrumb";
import {
  loadMainShell,
  MainHeader,
  ThemeLayoutContent,
} from "@vitnode/core/tanstack/layout";

import { MainFooter } from "@/components/main-footer";

export const Route = createFileRoute("/_main")({
  loader: async ({ context }) => await loadMainShell(context),
  component: MainLayout,
});

function MainLayout() {
  return (
    <div className="flex min-h-svh flex-col [&>main]:flex-1">
      <ThemeLayoutContent
        breadcrumb={<MainBreadcrumb />}
        header={<MainHeader />}
      >
        <Outlet />
      </ThemeLayoutContent>

      <MainFooter />
    </div>
  );
}
