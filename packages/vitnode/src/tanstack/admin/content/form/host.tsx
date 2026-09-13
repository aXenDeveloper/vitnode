import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import React from "react";

import type { ContentFormNavigation } from "@/views/admin/views/content/form/navigation";

import { ContentFormNavigationProvider } from "@/views/admin/views/content/form/navigation";
import { ContentFormTransportProvider } from "@/views/admin/views/content/form/transport";

import { contentFormTransport } from "./transport";

export const ContentFormHost = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  const transport = React.useMemo(
    () => contentFormTransport(queryClient),
    [queryClient],
  );

  const navigation = React.useMemo<ContentFormNavigation>(
    () => ({
      navigate: href => {
        void router.navigate({ href });
      },
      refresh: () => {
        void router.invalidate();
      },
    }),
    [router],
  );

  return (
    <ContentFormTransportProvider value={transport}>
      <ContentFormNavigationProvider value={navigation}>
        {children}
      </ContentFormNavigationProvider>
    </ContentFormTransportProvider>
  );
};
