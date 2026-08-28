import { Suspense } from "react";

import { getSessionApi } from "@/lib/api/get-session-api";

import type { VitNodeConfig } from "../../../vitnode.config";

import { HeaderLayout } from "./header/header";
import { ThemeLayoutContent } from "./layout-content";
import { NotificationListener } from "./notification-listener";
import { WebSocketAuthSync } from "./web-socket-auth-sync";

const WebSocketAuthSyncSession = async () => {
  const session = await getSessionApi();

  return <WebSocketAuthSync userId={session?.user?.id ?? null} />;
};

/**
 * The main shell for Next.js.
 *
 * The structure - the slot order and the `<main>` landmark - is
 * `ThemeLayoutContent`, shared with the TanStack Start app. What stays here is
 * the half that is genuinely Next.js: a header that is an async Server
 * Component, and a session read that only a Server Component can await.
 */
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
    <ThemeLayoutContent
      breadcrumb={breadcrumb}
      header={<HeaderLayout logo={logo} vitNodeConfig={vitNodeConfig} />}
      listeners={
        <>
          <NotificationListener />
          <Suspense>
            <WebSocketAuthSyncSession />
          </Suspense>
        </>
      }
    >
      {children}
    </ThemeLayoutContent>
  );
};
