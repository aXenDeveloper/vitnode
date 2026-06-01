import { AlertTriangleIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { HeaderContent } from "@/components/ui/header-content";
import { getSessionAdminApi } from "@/lib/api/get-session-admin-api";
import { CONFIG } from "@/lib/config";

import { SendNotificationAction } from "./send-notification/send-notification";

export const DashboardAdminView = async () => {
  const session = await getSessionAdminApi();
  const t = await getTranslations("admin.dashboard");
  if (!session) return null;
  const { user, vitnode_version } = session;

  return (
    <div className="p-4">
      <HeaderContent
        desc={t("version", { version: vitnode_version })}
        h1={
          <>
            <span>VitNode</span>
            {CONFIG.node_development && (
              <Badge
                className="ml-2 bg-yellow-500 text-black hover:bg-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-500"
                variant="destructive"
              >
                <AlertTriangleIcon className="size-4" /> {t("dev_mode")}
              </Badge>
            )}
          </>
        }
      />

      <div className="mt-4 max-w-2xl rounded-lg border p-4">
        <h2 className="mb-1 font-medium">Send a notification</h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Pushes a toast to the user in real time, on every browser where they
          are signed in. Defaults to your own user id.
        </p>
        <SendNotificationAction defaultUserId={user.id} />
      </div>
    </div>
  );
};
