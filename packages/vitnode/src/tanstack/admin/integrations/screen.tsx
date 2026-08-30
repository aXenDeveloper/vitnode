"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { HeaderContent } from "@/components/ui/header-content";
import { CONFIG_PLUGIN } from "@/config";
import { IntegrationsContent } from "@/views/admin/views/core/system/integrations/integrations-content";
import { sendTestEmailInBrowser } from "@/views/admin/views/core/system/integrations/send-test-email/send-test-email-mutation";

import type { AdminIntegrationsRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { useAdminPermission } from "../permissions";
import { integrationsQuery } from "./query";
import { ADMIN_INTEGRATIONS_NAMESPACES } from "./route";
import { SYSTEM_MODULE } from "./route";

export const AdminIntegrationsRouteContent = ({
  description,
  title,
}: AdminIntegrationsRouteData) => {
  const { data } = useSuspenseQuery(integrationsQuery());
  const canSendTestEmail = useAdminPermission({
    module: SYSTEM_MODULE,
    permission: "can_send_test_email",
    plugin: CONFIG_PLUGIN.pluginId,
  });
  const canTestStorage = useAdminPermission({
    module: SYSTEM_MODULE,
    permission: "can_test_storage",
    plugin: CONFIG_PLUGIN.pluginId,
  });
  const canTestAi = useAdminPermission({
    module: SYSTEM_MODULE,
    permission: "can_test_ai",
    plugin: CONFIG_PLUGIN.pluginId,
  });

  return (
    <RouteMessages namespaces={ADMIN_INTEGRATIONS_NAMESPACES}>
      <div className="p-4">
        <HeaderContent desc={description} h1={title} />

        <IntegrationsContent
          canSendTestEmail={canSendTestEmail}
          canTestAi={canTestAi}
          canTestStorage={canTestStorage}
          data={data}
          onSendTestEmail={sendTestEmailInBrowser}
        />
      </div>
    </RouteMessages>
  );
};
