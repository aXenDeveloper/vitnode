import { getSessionApi } from "@/lib/api/get-session-api";

import type { VitNodeConfig } from "../../../vitnode.config";

import { HeaderLayout } from "./header/header";
import { NotificationListener } from "./notification-listener";
import { WebSocketAuthSync } from "./web-socket-auth-sync";

export const ThemeLayout = async ({
  children,
  logo,
  vitNodeConfig,
}: React.ComponentProps<typeof HeaderLayout> & {
  children: React.ReactNode;
  vitNodeConfig: VitNodeConfig;
}) => {
  const { user } = await getSessionApi();

  return (
    <>
      <NotificationListener />
      <WebSocketAuthSync userId={user?.id ?? null} />
      <HeaderLayout logo={logo} vitNodeConfig={vitNodeConfig} />{" "}
      <main>{children}</main>
    </>
  );
};
