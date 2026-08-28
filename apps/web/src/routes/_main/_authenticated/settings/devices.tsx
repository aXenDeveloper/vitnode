import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { HeaderContent } from '@vitnode/core/components/ui/header-content'
import { DevicesContent } from '@vitnode/core/views/auth/settings/devices/devices-content'
import { DevicesListSkeleton } from '@vitnode/core/views/auth/settings/devices/devices-list-skeleton'
import { useTranslations } from 'use-intl'

import { SettingsBreadcrumb } from '#/components/layout/settings-breadcrumb'
import { devicesQuery, useRevokeDeviceCallback } from '#/lib/devices/devices'
import { loadSettingsPanel, settingsPanelHead } from '#/lib/settings/panel'

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
 * `/login?returnTo=/settings/devices`, and a second rule would be a second thing
 * to keep in step rather than defence in depth. The actual boundary is neither:
 * `GET /api/@vitnode/core/users/devices` derives the user from the session cookie
 * on every request, which is why a session that ends while this page is open
 * shows up below as a failed query rather than as somebody else's devices.
 *
 * ## One query contract, one cache entry
 *
 *     loader:     ensureQueryData(devicesQuery())
 *     component:  useSuspenseQuery(devicesQuery())
 *     after a revoke: invalidate that one entry, and the component refetches
 *
 * Same key, same request, same refusal handling - so the list the server rendered
 * is the list the browser reads. There is no `initialData`: the loader has already
 * put it in the entry the component reads and the SSR pass dehydrates it, so a
 * second copy of those bytes could only disagree with the first.
 *
 * ## What a revoke does *not* invalidate
 *
 * Anything else. The Next.js page ends its revoke with
 * `revalidatePath('/[locale]/(main)', 'layout')`, which re-renders the whole main
 * shell; here it is one query key. Not the session in particular, and that is a
 * finding rather than an omission: the API answers `400` when asked to revoke the
 * device the request itself comes from, so no revoke reachable from this page can
 * end the session performing it. See the note on `invalidateDevices`.
 */
export const Route = createFileRoute('/_main/_authenticated/settings/devices')({
  component: DevicesRoute,
  /**
   * The panel's strings and its list, in parallel.
   *
   * `loadSettingsPanel` is every settings panel's loader - it warms the settings
   * namespaces and translates the tab title - and is awaited *alongside* the
   * devices read rather than before it, so the two round trips overlap.
   *
   * A refusal from the devices API is deliberately left to propagate. `401`, `403`
   * and `429` reject as `DevicesRequestError`, which fails this loader and shows
   * the router's error path - the honest answer. The alternative, catching it and
   * rendering an empty list, tells the visitor they are signed in nowhere, which
   * is the one thing this page must never say by accident. It is also exactly what
   * the `getDevicesApi()` this replaces did.
   */
  loader: async ({ context }) => {
    const [panel] = await Promise.all([
      loadSettingsPanel(context, 'devices'),
      context.queryClient.ensureQueryData(devicesQuery()),
    ])

    return panel
  },
  /**
   * The tab title and nothing else - `robots` is the layout's, declared once for
   * the whole subtree.
   *
   * **`head` must be written after `loader`.** `loaderData`'s type is inferred
   * from `loader` in the same object literal, and TypeScript reads a literal's
   * members in order - put `head` first and `loaderData` is `never`.
   */
  head: ({ loaderData }) => settingsPanelHead(loaderData),
  /**
   * Where the Next.js page's `<Suspense fallback={<DevicesListSkeleton />}>` ends
   * up: the same skeleton, in the same place relative to the heading.
   *
   * Next.js streams the heading first and fills the list in; a router shows this
   * once a navigation into the route has been pending long enough to notice.
   * Neither appears on a first paint - the loader has the list before anything
   * renders - so this is the slow-client-navigation case and only that.
   *
   * ## Why it may translate, having mounted no provider
   *
   * `DevicesHeading` calls `useTranslations`, and this fallback is rendered
   * without the panel's own component ever running - so the question is whether
   * `settings.tsx`'s `RouteMessages` is above it by then. It always is, for one
   * structural reason: a `pendingComponent` stands in for the *panel*, and the
   * panel is rendered into the layout's `<Outlet />` - which exists only because
   * the layout's own component ran, which is what mounts the provider. A pending
   * match renders its pending element *instead of* its component, so a layout that
   * is itself pending renders no `<Outlet />` and therefore no panel state at all.
   * Nothing about what the layout declares enters into it.
   *
   * The constraint that does fall out: this must stay inside the settings subtree.
   * A translating fallback rendered *above* that provider - a `pendingComponent`
   * on the layout itself, say - would throw rather than degrade, and would have to
   * mount `RouteMessages` of its own.
   */
  pendingComponent: DevicesPending,
  staticData: { breadcrumb: <SettingsBreadcrumb navKey="devices" /> },
})

/**
 * The panel heading, which both states below render identically.
 *
 * `core.auth.settings.devices.title` and `.desc` - the panel's own `<h2>`, not
 * the settings `<h1>` the layout renders and not the `nav.devices` label the tab
 * title is built from.
 */
const DevicesHeading = () => {
  const t = useTranslations('core.auth.settings.devices')

  return <HeaderContent desc={t('desc')} h2={t('title')} />
}

function DevicesPending() {
  return (
    <>
      <DevicesHeading />
      <DevicesListSkeleton />
    </>
  )
}

function DevicesRoute() {
  const { data } = useSuspenseQuery(devicesQuery())
  const onRevoke = useRevokeDeviceCallback()

  return (
    <>
      <DevicesHeading />

      {/*
        The same component the Next.js page renders, handed the two things a
        shared list cannot resolve for itself: the devices, and the revoke.

        The revoke goes straight from the browser to Hono - no server function in
        between, because it needs no server-only secret and sets no cookie - and
        ends in an invalidation of the one `devices/me` entry, but only when the
        list is actually wrong. A `429` or a `401` left it exactly as it was, and
        refetching would send the same read back into whatever refused the first.
        That rule is core's (`shouldRefreshAfterRevoke`) and is applied by
        `#/lib/devices/devices`, so both frameworks refresh on the same condition.
      */}
      <DevicesContent devices={data.devices} onRevoke={onRevoke} />
    </>
  )
}
