import type { AnyRoute } from "@tanstack/react-router";

import { createRoute, Outlet } from "@tanstack/react-router";

import type { SettingsLoaderContext, SettingsNavKey } from "../../settings";
import type { CoreRouteFactory } from "../types";

import {
  DevicesPanelContent,
  DevicesPanelPending,
  devicesQuery,
} from "../../devices";
import { RouteMessages } from "../../i18n";
import { RouterLink } from "../../layout";
import {
  loadSettingsPanel,
  OverviewSettings,
  SecuritySettings,
  SETTINGS_NAMESPACES,
  SettingsBreadcrumbContent,
  SettingsLayoutContent,
  settingsMessagesQueryOptions,
} from "../../settings";
import { routeContext } from "../types";

/**
 * The settings trail.
 *
 * Two things, and the rest is `SettingsBreadcrumbContent`: the strings this
 * subtree renders in - the same set every settings route warms - and the link
 * component. `RouterLink` is passed rather than defaulted because the crumb
 * itself lives in `views/`, which is shared with hosts on other frameworks and
 * may not import a router.
 *
 * The trail is derived from the shared navigation model rather than written
 * here, so a panel's crumb and its menu entry cannot drift into two spellings of
 * the same path.
 */
const SettingsBreadcrumb = ({ navKey }: { navKey?: SettingsNavKey }) => (
  <RouteMessages namespaces={SETTINGS_NAMESPACES}>
    <SettingsBreadcrumbContent LinkComponent={RouterLink} navKey={navKey} />
  </RouteMessages>
);

/**
 * `/settings` - the settings frame: the heading, the navigation card, and the
 * panel every settings page renders inside, with its four panels nested under
 * it.
 *
 * A real nested layout route rather than a wrapper each page remembers to
 * render, so a panel joins the frame by being its child and cannot forget to.
 * That nesting is also why this is one factory rather than five: a panel's path
 * is *relative* to the layout's, and the index panel's is `"/"` - which is what
 * makes `/settings` render the overview rather than redirecting to
 * `/settings/overview`.
 *
 * Rendering rather than redirecting is a product decision. The frame shows the
 * navigation *instead of* the panel on a narrow screen, so a visitor who opens
 * `/settings` on a phone is looking at a menu; redirecting would skip the menu
 * entirely and leave the mobile back link as the only way to reach it. On a
 * desktop the two URLs look identical. They differ in exactly one visible way,
 * which is the breadcrumb: the index declares none and inherits the frame's
 * single crumb, while `/settings/overview` is two crumbs deep.
 */
export const settingsRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const layout = createRoute({
    getParentRoute: () => parentRoute,
    /**
     * The strings the frame renders, warmed before it renders.
     *
     * `ensureQueryData` rather than a prefetch, because `RouteMessages` reads
     * them back with `useSuspenseQuery` and there is no Suspense boundary
     * between it and the document: an unwarmed entry does not degrade here, it
     * suspends the whole response.
     *
     * The session is deliberately not fetched. The authenticated container's
     * `beforeLoad` has already put it in the one cache entry every guard reads,
     * and this frame has no use for it - it renders nothing about the visitor.
     */
    loader: async ({ context }) => {
      const narrowed = routeContext<SettingsLoaderContext>(context);

      await narrowed.queryClient.ensureQueryData(
        settingsMessagesQueryOptions(narrowed.locale),
      );
    },
    /**
     * `noindex, nofollow` for the whole settings subtree, declared exactly once.
     *
     * TanStack Router merges the `head` of every matched route and dedupes
     * `meta` by `name`, preferring the deepest occurrence - so a panel inherits
     * this by saying nothing, and only a panel that deliberately wanted to be
     * indexed would restate the tag. A panel's own `head` is therefore a title
     * and nothing else.
     */
    head: () => ({ meta: [{ content: "noindex, nofollow", name: "robots" }] }),
    path: "/settings",
    /**
     * The trail for `/settings` itself - a single "Settings" crumb. A panel
     * declares its own two-crumb trail and wins by being deeper.
     */
    staticData: { breadcrumb: <SettingsBreadcrumb /> },
    component: function SettingsLayout() {
      return (
        <SettingsLayoutContent LinkComponent={RouterLink}>
          <Outlet />
        </SettingsLayoutContent>
      );
    },
  });

  /**
   * One panel: warm the strings, translate the tab title, render.
   *
   * `navKey` is the whole of what differs between three of the four - the
   * component, the title and the crumb are all derived from it - so they are one
   * builder rather than three near-identical routes. `path` is relative to the
   * layout above.
   */
  const panel = (
    navKey: SettingsNavKey,
    path: string,
    Panel: React.FunctionComponent,
    { crumb = true }: { crumb?: boolean } = {},
  ): AnyRoute =>
    createRoute({
      getParentRoute: () => layout,
      // `head` after `loader`, always.
      loader: async ({ context }) =>
        await loadSettingsPanel(routeContext(context), navKey),
      head: ({ loaderData }) => pageHead({ ...loaderData }),
      path,
      component: Panel,
      ...(crumb
        ? { staticData: { breadcrumb: <SettingsBreadcrumb navKey={navKey} /> } }
        : {}),
    });

  /**
   * `/settings/devices` - where this account is signed in.
   *
   * Built on its own because it is the one panel with data of its own: the
   * strings and the device list are awaited *together* rather than one after the
   * other, so the two round trips overlap.
   */
  const devices: AnyRoute = createRoute({
    getParentRoute: () => layout,
    /**
     * `context.auth` is the authenticated container's `beforeLoad` return,
     * already narrowed to the signed-in half of the union, so `auth.user` needs
     * no check. The id is taken once, here, and returned, so the loader, the
     * component and the revoke callback all use the identical value.
     *
     * A refusal from the devices API is deliberately left to propagate. `401`,
     * `403` and `429` reject as `DevicesRequestError`, which fails this loader
     * and shows the router's error path - the honest answer. Catching it and
     * rendering an empty list tells the visitor they are signed in nowhere,
     * which is the one thing this page must never say by accident.
     */
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
    pendingComponent: DevicesPanelPending,
    staticData: { breadcrumb: <SettingsBreadcrumb navKey="devices" /> },
  });

  devices.update({
    component: function DevicesRoute() {
      return <DevicesPanelContent userId={devices.useLoaderData().userId} />;
    },
  });

  layout.addChildren([
    panel("overview", "/", OverviewSettings, { crumb: false }),
    panel("overview", "/overview", OverviewSettings),
    panel("security", "/security", SecuritySettings),
    devices,
  ]);

  return layout;
};
