import { useRouter } from "@tanstack/react-router";

import type { VitNodeProvidersConfig } from "@/views/layouts/providers";

import { LucideIconCollectorContext } from "@/components/ui/icon-registry";
import { VitNodeProviders } from "@/views/layouts/providers";
import { VitNodeWebSocketProvider } from "@/ws/provider";

import { RouteMessages } from "../i18n/route-messages";
import { lucideIconCollectorOf } from "../icons/ssr";
import { RealtimeListeners } from "../realtime/realtime-listeners";

export const VitNodeRootProviders = ({
  children,
  config,
}: {
  children: React.ReactNode;
  config: VitNodeProvidersConfig;
}) => {
  const router = useRouter();

  return (
    <LucideIconCollectorContext.Provider value={lucideIconCollectorOf(router)}>
      <RouteMessages>
        <VitNodeProviders config={config}>
          <VitNodeWebSocketProvider>
            <RealtimeListeners />
            {children}
          </VitNodeWebSocketProvider>
        </VitNodeProviders>
      </RouteMessages>
    </LucideIconCollectorContext.Provider>
  );
};
