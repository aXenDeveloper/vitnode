"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import React from "react";

import type { ContentFormNavigation } from "@/views/admin/views/content/form/navigation";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { ContentEditorialTransportProvider } from "@/views/admin/views/content/actions/editorial-transport";
import { ContentFormNavigationProvider } from "@/views/admin/views/content/form/navigation";

import { RouterLink } from "../../../layout/router-link";
import { contentEditorialTransport } from "./transport";

/**
 * The two seams an editorial panel reads, wired to TanStack Start.
 *
 * Mounted by each panel rather than by the list, and that is deliberate: the
 * list screen has no form and no panels of its own, and a host that renders only
 * a table should pay for neither provider. It is the same choice `ContentFormHost`
 * makes one screen over. Mounting all three above every content screen at once
 * would be simpler to write and would put two providers into every table.
 *
 * Both providers are needed and neither is redundant:
 *
 *     ContentEditorialTransportProvider  the requests, and what each write expires
 *     ContentFormNavigationProvider      the link on a revision's author, and
 *                                        `refresh` after a restore
 *
 * ## `refresh` is a router invalidation, not a navigation
 *
 * Asking this router to navigate to the href it is already on does nothing at
 * all, so the intent is spelled `router.invalidate()` - re-run the route's loader
 * and re-render it. The **data** is not that call's job: the transport has
 * already expired the record, the list and everything under them, against the
 * same keys the loader warms. What is left is everything outside React Query -
 * the heading a restore renames, the breadcrumb behind the dialog.
 */
export const ContentEditorialHost = ({
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
    () => contentEditorialTransport(queryClient),
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
    <ContentEditorialTransportProvider value={transport}>
      <ContentFormNavigationProvider value={navigation}>
        {children}
      </ContentFormNavigationProvider>
    </ContentEditorialTransportProvider>
  );
};
