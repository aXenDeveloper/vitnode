import { createFileRoute } from '@tanstack/react-router'
import {
  DevicesPanelContent,
  DevicesPanelPending,
  devicesQuery,
} from '@vitnode/core/tanstack/devices'

import { loadSettingsPanel, settingsPanelHead } from '#/lib/settings/panel'
import { SettingsBreadcrumb } from '#/migration/settings-breadcrumb'

/**
 * `/settings/devices` - the devices the visitor is signed in on.
 *
 * The first settings panel with data of its own, and therefore the first whose
 * loader is more than `loadSettingsPanel`. Everything around the list belongs to
 * `settings.tsx`: the container, the `<h1>`, the navigation card, the panel card,
 * the mobile back link, the `noindex` on the whole subtree, and the
 * `RouteMessages` provider that puts `core.auth.settings` and `core.global` in
 * scope. This route renders the panel *body* - which is exactly what the Next.js
 * `DevicesSettings` renders inside `LayoutSettings`.
 *
 * There is deliberately no session check here. `_authenticated`'s `beforeLoad`
 * has already answered an anonymous visitor with
 * `/login?returnTo=/settings/devices`. The actual boundary is neither:
 * `GET /api/@vitnode/core/users/devices` derives the user from the session cookie
 * on every request, which is why a session that ends while this page is open
 * shows up as a failed query rather than as somebody else's devices.
 *
 * ## One query contract, one cache entry
 *
 *     loader:     ensureQueryData(devicesQuery(userId))
 *     component:  useSuspenseQuery(devicesQuery(userId))
 *     after a revoke: invalidate that one entry, and the component refetches
 *
 * Same key, same request, same refusal handling - so the list the server rendered
 * is the list the browser reads. The entry is keyed by the visitor because the
 * browser's `QueryClient` outlives a sign-out: under a single `["devices", "me"]`
 * a second visitor signing in on the same document would have found it populated,
 * made no request, and been shown the first visitor's devices.
 */
export const Route = createFileRoute('/_main/_authenticated/settings/devices')({
  /**
   * The panel's strings and its list, in parallel.
   *
   * `loadSettingsPanel` is every settings panel's loader - it warms the settings
   * namespaces and translates the tab title - and is awaited *alongside* the
   * devices read rather than before it, so the two round trips overlap.
   *
   * `context.auth` is `_authenticated`'s `beforeLoad` return, already narrowed to
   * the signed-in half of the union, so `auth.user` needs no check. The id is
   * taken once, here, and returned, so the loader, the component and the revoke
   * callback all use the identical value.
   *
   * A refusal from the devices API is deliberately left to propagate. `401`,
   * `403` and `429` reject as `DevicesRequestError`, which fails this loader and
   * shows the router's error path - the honest answer. Catching it and rendering
   * an empty list tells the visitor they are signed in nowhere, which is the one
   * thing this page must never say by accident.
   */
  loader: async ({ context }) => {
    const userId = context.auth.user.id

    const [panel] = await Promise.all([
      loadSettingsPanel(context, 'devices'),
      context.queryClient.ensureQueryData(devicesQuery(userId)),
    ])

    return { ...panel, userId }
  },
  // The tab title and nothing else - `robots` is the layout's, declared once for
  // the whole subtree. `head` after `loader`, always.
  head: ({ loaderData }) => settingsPanelHead(loaderData),
  pendingComponent: DevicesPanelPending,
  staticData: { breadcrumb: <SettingsBreadcrumb navKey="devices" /> },
  component: DevicesRoute,
})

function DevicesRoute() {
  return <DevicesPanelContent userId={Route.useLoaderData().userId} />
}
