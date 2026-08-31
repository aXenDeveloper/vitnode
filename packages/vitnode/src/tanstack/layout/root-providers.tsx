"use client";

import type { VitNodeProvidersConfig } from "@/views/layouts/providers";

import { VitNodeProviders } from "@/views/layouts/providers";
import { VitNodeWebSocketProvider } from "@/ws/provider";

import { RouteMessages } from "../i18n/route-messages";
import { RealtimeListeners } from "../realtime/realtime-listeners";

/**
 * The provider tree every VitNode TanStack Start application mounts, once,
 * above every route.
 *
 * A root route's `component` is this and its `<Outlet />`. Everything in it has
 * the lifetime of the document rather than of any route, which is the whole
 * reason it is here and not in a shell: a login screen needs the theme, the
 * query cache's intl records and the WebSocket exactly as much as a page inside
 * the site header does.
 *
 * ## Why the messages come from `RouteMessages`
 *
 * With no `namespaces` it provides exactly `core.global` - the shell strings a
 * root loader warms - which is what a root route wants. It is the same component
 * a page mounts for its own namespaces, and using it here rather than mounting
 * `use-intl`'s provider directly is what keeps an application from owning a
 * second copy of a rule it has already been bitten by: the provider has to be
 * mounted *twice*, into two `use-intl` module records, and only this package can
 * name the second one. See the long note in `../i18n/route-messages`.
 *
 * ## Why `RealtimeListeners` is inside it rather than in the main shell
 *
 * It is the one non-provider in this tree, and it is here for the same reason
 * every provider is: its lifetime is the WebSocket connection's, not any
 * route's. A main shell is not mounted on `/login`, so a sign-in resync that
 * lived there would not exist during the sign-in it has to notice. Inside the
 * provider, because that is the context it reads.
 *
 * The QueryClient is deliberately absent: the router owns it and the SSR
 * integration mounts its provider above this tree.
 */
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
