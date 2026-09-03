"use client";

import type { VitNodeProvidersConfig } from "@/views/layouts/providers";

import { VitNodeProviders } from "@/views/layouts/providers";
import { VitNodeWebSocketProvider } from "@/ws/provider";

import { RouteMessages } from "../i18n/route-messages";
import { RealtimeListeners } from "../realtime/realtime-listeners";

export const VitNodeRootProviders = ({
  children,
  config,
}: {
  children: React.ReactNode;
  config: VitNodeProvidersConfig;
}) => (
  <RouteMessages>
    <VitNodeProviders config={config}>
      <VitNodeWebSocketProvider>
        <RealtimeListeners />
        {children}
      </VitNodeWebSocketProvider>
    </VitNodeProviders>
  </RouteMessages>
);
