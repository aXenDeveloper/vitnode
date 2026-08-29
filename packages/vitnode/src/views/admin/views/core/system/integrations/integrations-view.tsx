import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { fetcher } from "@/lib/fetcher";

import { IntegrationsContent } from "./integrations-content";
import { integrationsRequest } from "./integrations-query";
import { sendTestEmailMutation } from "./send-test-email/mutation-api.server";

export { IntegrationsViewSkeleton } from "./integrations-content";

/**
 * The Next.js half of `/admin/core/system/integrations`: read the board's data
 * and the three test permissions, then hand them to the shared grid.
 *
 * A Server Component, so `fetcher()` and `checkAdminPermissionApi` both read the
 * admin cookie through `next/headers`. The request is `integrationsRequest`'s -
 * the same object the TanStack Start loader sends - and the test-email mutation
 * stays the server action it has always been.
 */
export const IntegrationsView = async () => {
  const [res, canSendTestEmail, canTestStorage, canTestAi] = await Promise.all([
    fetcher(debugAdminModule, integrationsRequest),
    checkAdminPermissionApi({
      module: "system",
      permission: "can_send_test_email",
    }),
    checkAdminPermissionApi({
      module: "system",
      permission: "can_test_storage",
    }),
    checkAdminPermissionApi({
      module: "system",
      permission: "can_test_ai",
    }),
  ]);

  const data = await res.json();

  return (
    <IntegrationsContent
      canSendTestEmail={canSendTestEmail}
      canTestAi={canTestAi}
      canTestStorage={canTestStorage}
      data={data}
      onSendTestEmail={sendTestEmailMutation}
    />
  );
};
