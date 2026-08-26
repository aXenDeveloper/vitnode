import { Suspense } from "react";

import { getSessionApi } from "@/lib/api/get-session-api";

import type { VitNodeConfig } from "../../../vitnode.config";

import { HeaderLayout } from "./header/header";
import { NotificationListener } from "./notification-listener";
import { WebSocketAuthSync } from "./web-socket-auth-sync";

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
      <Suspense>
        <WebSocketAuthSyncSession />
      </Suspense>
      <HeaderLayout logo={logo} vitNodeConfig={vitNodeConfig} />
      {breadcrumb}
      <main>{children}</main>
    </>
  );
};
