"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import React from "react";

import type { ContentFormNavigation } from "@/views/admin/views/content/form/navigation";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { ContentFormNavigationProvider } from "@/views/admin/views/content/form/navigation";
import { ContentFormTransportProvider } from "@/views/admin/views/content/form/transport";

import { RouterLink } from "../../../layout/router-link";
import { contentFormTransport } from "./transport";

/**
 * The Content Engine's two seams, wired to TanStack Start.
 *
 * The counterpart of `form/host-next.tsx`. Mounted by each of the three things
 * that can contain a form - the create dialog, the edit dialog and the page-mode
 * screen - rather than by the route shell, and that is deliberate: it keeps this
 * whole feature out of `route.tsx`, so the list screen and the form screens stay
 * independently mountable and a host that renders only a list pays for neither
 * provider.
 *
 * ## `refresh` is a router invalidation, not a navigation
 *
 * The Next.js host spells `refresh` as `push(pathname)`, which is how an App
 * Router page refetches its RSC payload. Asking this router to navigate to the
 * href it is already on does nothing at all, so the intent is spelled with
 * `router.invalidate()` - re-run this route's loader and re-render it.
 *
 * The **data** is not this call's job and must not be: the transport already
 * invalidated the list, the record and every picker onto this content type,
 * against the same query keys the loader warms. What is left for the router is
 * everything outside React Query - the page title a save changes, the breadcrumb
 * an edit renames - which is exactly what a loader re-run produces.
 */
export const ContentFormHost = ({
  children,
  LinkComponent = RouterLink,
}: {
  children: React.ReactNode;
  /** How a path becomes a navigation. See {@link RouterLink} for the default. */
  LinkComponent?: AuthLinkComponent;
}) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  const transport = React.useMemo(
    () => contentFormTransport(queryClient),
    [queryClient],
  );

  const navigation = React.useMemo<ContentFormNavigation>(
    () => ({
      LinkComponent,
      navigate: href => {
        void router.navigate({ href });
      },
      refresh: () => {
        void router.invalidate();
      },
    }),
    [LinkComponent, router],
  );

  return (
    <ContentFormTransportProvider value={transport}>
      <ContentFormNavigationProvider value={navigation}>
        {children}
      </ContentFormNavigationProvider>
    </ContentFormTransportProvider>
  );
};
