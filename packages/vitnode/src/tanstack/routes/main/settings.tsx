import type { AnyRoute } from "@tanstack/react-router";

import {
  createRoute,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";

import { SettingsBreadcrumbContent } from "@/views/auth/settings/settings-breadcrumb-content";

import type {
  SettingsLoaderContext,
  SettingsNavKey,
} from "../../settings/route";
import type { CoreRouteFactory } from "../types";

import { devicesQuery } from "../../devices/query";
import { RouteMessages } from "../../i18n/route-messages";
import { RouterLink } from "../../layout/router-link";
import { FeedPendingSkeleton, FormPendingSkeleton } from "../../pending";
import {
  loadSettingsPanel,
  SETTINGS_NAMESPACES,
  settingsMessagesQueryOptions,
} from "../../settings/route";
import { routeContext } from "../types";

const SettingsBreadcrumb = ({ navKey }: { navKey?: SettingsNavKey }) => (
  <RouteMessages namespaces={SETTINGS_NAMESPACES}>
    <SettingsBreadcrumbContent navKey={navKey} />
  </RouteMessages>
);

export const settingsRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const layout = createRoute({
    getParentRoute: () => parentRoute,

    loader: async ({ context }) => {
      const narrowed = routeContext<SettingsLoaderContext>(context);

      await narrowed.queryClient.ensureQueryData(
        settingsMessagesQueryOptions(narrowed.locale),
      );
    },

    head: () => ({ meta: [{ content: "noindex, nofollow", name: "robots" }] }),
    path: "/settings",
    pendingComponent: () => (
      <FormPendingSkeleton className="container mx-auto" />
    ),
    /**
     * The first crumb of the trail - "Settings", linking to this frame's own
     * URL. Each panel adds its own after it.
     */
    staticData: { breadcrumb: <SettingsBreadcrumb /> },
  });

  layout.update({
    component: lazyRouteComponent(async () => {
      const { SettingsLayoutContent } = await import("../../settings/layout");

      return {
        default: function SettingsLayout() {
          return (
            <SettingsLayoutContent LinkComponent={RouterLink}>
              <Outlet />
            </SettingsLayoutContent>
          );
        },
      };
    }),
  });

  const panel = (
    navKey: SettingsNavKey,
    path: string,
    loadPanel: () => Promise<{ default: React.FunctionComponent }>,
    { crumb = true }: { crumb?: boolean } = {},
  ): AnyRoute =>
    createRoute({
      getParentRoute: () => layout,
      // `head` after `loader`, always.
      loader: async ({ context }) =>
        await loadSettingsPanel(routeContext(context), navKey),
      head: ({ loaderData }) => pageHead({ ...loaderData }),
      path,
      component: lazyRouteComponent(loadPanel),
      pendingComponent: FormPendingSkeleton,
      ...(crumb
        ? { staticData: { breadcrumb: <SettingsBreadcrumb navKey={navKey} /> } }
        : {}),
    });

  const devices: AnyRoute = createRoute({
    getParentRoute: () => layout,

    loader: async ({ context }) => {
      const narrowed = routeContext<
        SettingsLoaderContext & { auth: { user: { id: number } } }
      >(context);
      const userId = narrowed.auth.user.id;

      const [data] = await Promise.all([
        loadSettingsPanel(narrowed, "devices"),
        narrowed.queryClient.ensureQueryData({
          ...devicesQuery(userId),
          revalidateIfStale: true,
        }),
      ]);

      return { ...data, userId };
    },
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/devices",
    pendingComponent: () => <FeedPendingSkeleton rows={4} />,
    staticData: { breadcrumb: <SettingsBreadcrumb navKey="devices" /> },
  });

  devices.update({
    component: lazyRouteComponent(async () => {
      const { DevicesPanelContent } = await import("../../devices/panel");

      return {
        default: function DevicesRoute() {
          return (
            <DevicesPanelContent userId={devices.useLoaderData().userId} />
          );
        },
      };
    }),
  });

  layout.addChildren([
    panel(
      "overview",
      "/",
      async () => ({
        default: (await import("@/views/auth/settings/overview/overview"))
          .OverviewSettings,
      }),
      { crumb: false },
    ),
    panel("overview", "/overview", async () => ({
      default: (await import("@/views/auth/settings/overview/overview"))
        .OverviewSettings,
    })),
    panel("security", "/security", async () => ({
      default: (await import("@/views/auth/settings/security/security"))
        .SecuritySettings,
    })),
    devices,
  ]);

  return layout;
};
