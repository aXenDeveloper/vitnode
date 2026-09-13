import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import React from "react";

import type { ContentFormNavigation } from "@/views/admin/views/content/form/navigation";

import { ContentEditorialTransportProvider } from "@/views/admin/views/content/actions/editorial-transport";
import { ContentFormNavigationProvider } from "@/views/admin/views/content/form/navigation";

import { contentEditorialTransport } from "./transport";

export const ContentEditorialHost = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  const transport = React.useMemo(
    () => contentEditorialTransport(queryClient),
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
    <ContentEditorialTransportProvider value={transport}>
      <ContentFormNavigationProvider value={navigation}>
        {children}
      </ContentFormNavigationProvider>
    </ContentEditorialTransportProvider>
  );
};
