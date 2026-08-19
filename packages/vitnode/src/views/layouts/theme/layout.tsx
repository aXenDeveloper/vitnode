import { Suspense } from "react";

import { getSessionApi } from "@/lib/api/get-session-api";

import type { VitNodeConfig } from "../../../vitnode.config";

import { HeaderLayout } from "./header/header";
import { NotificationListener } from "./notification-listener";
import { WebSocketAuthSync } from "./web-socket-auth-sync";

/**
 * Reads the session purely to tell {@link WebSocketAuthSync} who is signed in.
 * Split out of the layout so the session read sits under its own `<Suspense>`:
 * awaiting it in the layout body pulled every themed route into request time,
 * and nothing above this point needs the user.
 */
const WebSocketAuthSyncSession = async () => {
  const session = await getSessionApi();

  return <WebSocketAuthSync userId={session?.user?.id ?? null} />;
};

export const ThemeLayout = ({
  children,
  logo,
  vitNodeConfig,
  breadcrumb,
}: React.ComponentProps<typeof HeaderLayout> & {
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
  vitNodeConfig: VitNodeConfig;
}) => {
  return (
    <>
      <NotificationListener />
      {/* Renders nothing, so an empty fallback costs no layout shift. */}
      <Suspense>
        <WebSocketAuthSyncSession />
      </Suspense>
      <HeaderLayout logo={logo} vitNodeConfig={vitNodeConfig} />
      {breadcrumb}
      <main>{children}</main>
    </>
  );
};
