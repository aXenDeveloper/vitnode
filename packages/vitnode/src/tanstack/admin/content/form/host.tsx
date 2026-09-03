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
