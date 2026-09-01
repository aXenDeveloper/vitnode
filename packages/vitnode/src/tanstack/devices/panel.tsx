"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { HeaderContent } from "@/components/ui/header-content";
import { DevicesContent } from "@/views/auth/settings/devices/devices-content";
import { DevicesListSkeleton } from "@/views/auth/settings/devices/devices-list-skeleton";

import { devicesQuery, useRevokeDeviceCallback } from "./query";

/**
 * The panel heading, which both states below render identically.
 *
 * `core.auth.settings.devices.title` and `.desc` - the panel's own `<h2>`, not
 * the settings `<h1>` the layout renders and not the `nav.devices` label the tab
 * title is built from.
 */
const DevicesHeading = () => {
  const t = useTranslations("core.auth.settings.devices");

  return <HeaderContent desc={t("desc")} h2={t("title")} />;
};

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
 * without the panel's own component ever running - so the question is whether the
 * settings layout's `RouteMessages` is above it by then. It always is, for one
 * structural reason: a `pendingComponent` stands in for the *panel*, and the
 * panel is rendered into the layout's `<Outlet />` - which exists only because
 * the layout's own component ran, which is what mounts the provider. A pending
 * match renders its pending element *instead of* its component, so a layout that
 * is itself pending renders no `<Outlet />` and therefore no panel state at all.
 *
 * The constraint that does fall out: this must stay inside the settings subtree.
 * A translating fallback rendered *above* that provider - a `pendingComponent`
 * on the layout itself, say - would throw rather than degrade.
 */
export const DevicesPanelPending = () => (
  <>
    <DevicesHeading />
    <DevicesListSkeleton />
  </>
);

/**
 * `/settings/devices`, as everything below a route file's `component`.
 *
 * `userId` addresses a cache entry and nothing else: `GET /users/devices` takes
 * no arguments and derives the owner from the session cookie on every request.
 * It comes from the host's `_authenticated` guard - the one canonical session
 * query - and is read once in the loader so the loader, this component and the
 * revoke callback all use the identical value.
 */
export const DevicesPanelContent = ({ userId }: { userId: number }) => {
  const { data } = useSuspenseQuery(devicesQuery(userId));
  const onRevoke = useRevokeDeviceCallback(userId);

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
      */}
      <DevicesContent devices={data.devices} onRevoke={onRevoke} />
    </>
  );
};
