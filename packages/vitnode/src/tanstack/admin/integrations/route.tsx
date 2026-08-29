"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createTranslator } from "use-intl";

import { HeaderContent } from "@/components/ui/header-content";
import { CONFIG_PLUGIN } from "@/config";
import { IntegrationsContent } from "@/views/admin/views/core/system/integrations/integrations-content";
import { sendTestEmailInBrowser } from "@/views/admin/views/core/system/integrations/send-test-email/send-test-email-mutation";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { RouteMessages } from "../../i18n/route-messages";
import { useAdminPermission } from "../permissions";
import { requireAdminPermission } from "../screen";
import { integrationsQuery } from "./query";

/**
 * `/admin/core/system/integrations`, as everything a TanStack Start route needs
 * and nothing a route owns.
 */

/**
 * What this screen renders strings from.
 *
 * `admin.system.integrations` is the heading, the nine cards and all three test
 * dialogs; `core.global` is the error toasts and the form chrome the dialogs
 * render inside. The same set the Next.js page's
 * `<I18nProvider namespaces="admin.system.integrations">` provides.
 */
export const ADMIN_INTEGRATIONS_NAMESPACES = [
  "admin.system.integrations",
  "core.global",
] as const;

/** What {@link loadAdminIntegrationsRoute} returns - and what `head` receives. */
export interface AdminIntegrationsRouteData {
  description: string;
  title: string;
}

/** The core plugin's `system` module, which all four tuples on this screen use. */
const SYSTEM_MODULE = "system";

/**
 * The tuple `<AdminPermissionRequired module="system" permission="can_view">`
 * states in the Next.js page, and the one `integrationsDebugAdminRoute`
 * declares.
 */
const SYSTEM_VIEW_PERMISSION = {
  module: SYSTEM_MODULE,
  permission: "can_view",
} as const;

/**
 * Both reads this screen needs, in parallel, before it renders.
 *
 * The permission is checked first, so an administrator who may not open the
 * screen never sends a request the API is going to refuse.
 *
 * A refusal is left to propagate. The board reports which subsystems are up, and
 * an errored read rendered as nine `inactive` cards would be a false alarm about
 * every integration at once - the loudest possible way to be wrong.
 */
export const loadAdminIntegrationsRoute = async ({
  adminAccess,
  locale,
  queryClient,
}: AdminScreenContext): Promise<AdminIntegrationsRouteData> => {
  requireAdminPermission(adminAccess, SYSTEM_VIEW_PERMISSION);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_INTEGRATIONS_NAMESPACES }),
    ),
    queryClient.ensureQueryData(integrationsQuery()),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: { system: { integrations: { desc: string; title: string } } };
    },
    namespace: "admin.system.integrations",
  });

  return { description: t("desc"), title: t("title") };
};

/**
 * `/admin/core/system/integrations`, as everything below a route file's
 * `component`.
 *
 * The three test permissions are read here from the admin session the guard
 * already resolved - a context read rather than the three extra API calls the
 * Next.js page spends on `checkAdminPermissionApi`. They decide which buttons
 * render; the API re-checks each tuple on the request itself.
 *
 * The test-email mutation is the browser one. The Next.js page keeps its server
 * action, and both satisfy `SendTestEmail`, so the dialog is identical.
 */
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
