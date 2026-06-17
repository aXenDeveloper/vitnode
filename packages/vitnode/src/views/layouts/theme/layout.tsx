import { getSessionApi } from "@/lib/api/get-session-api";

import type { VitNodeConfig } from "../../../vitnode.config";

import { HeaderLayout } from "./header/header";
import { NotificationListener } from "./notification-listener";
import { WebSocketAuthSync } from "./web-socket-auth-sync";

export const ThemeLayout = async ({
  children,
  logo,
  vitNodeConfig,
  breadcrumb,
}: React.ComponentProps<typeof HeaderLayout> & {
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
  vitNodeConfig: VitNodeConfig;
}) => {
  const session = await getSessionApi();
  const user = session?.user ?? null;

  return (
    <>
      <NotificationListener />
      <WebSocketAuthSync userId={user?.id ?? null} />
      <HeaderLayout logo={logo} vitNodeConfig={vitNodeConfig} />
      {breadcrumb}
      <main>{children}</main>
    </>
  );
};
