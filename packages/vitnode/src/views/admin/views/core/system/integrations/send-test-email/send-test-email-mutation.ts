import type { z } from "zod";

import type { zodSendTestEmailSchema } from "@/api/modules/admin/debug/routes/send-test-email.route";

import { fetcherClient } from "@/lib/fetcher-client";
import { debugAdminModuleRef } from "@/views/admin/views/core/system/integrations/integrations-query";

/**
 * Sending a test email, as a contract both frameworks satisfy.
 *
 * `POST /admin/debug/send-test-email` declares
 * `adminStaffPermission: { module: "system", permission: "can_send_test_email" }`
 * and re-checks it on every request, so the browser may call it directly and
 * there is no server function in between.
 *
 * The Next.js app keeps its server action - not because the mutation needs a
 * server, but because changing how the Next.js AdminCP sends this request is not
 * part of migrating the TanStack one. Both satisfy {@link SendTestEmail}, so the
 * dialog takes one and stops caring.
 */

export type SendTestEmailBody = z.infer<typeof zodSendTestEmailSchema>;

/** What the dialog is handed instead of a mutation. */
export type SendTestEmail = (
  body: SendTestEmailBody,
) => Promise<{ data?: unknown; error?: string }>;

/** Sends the test email from the browser. */
export const sendTestEmailInBrowser: SendTestEmail = async body => {
  try {
    const response = await fetcherClient(debugAdminModuleRef, {
      args: { body },
      method: "post",
      module: "debug",
      options: { credentials: "include" },
      path: "/send-test-email",
      prefixPath: "/admin",
    });

    if (!response.ok) return { error: await response.text() };

    return { data: await response.json() };
  } catch {
    // `rawApiFetch` throws on a 500 with the server's own error text, which has
    // already been logged where a log belongs. The dialog needs an outcome.
    return { error: "Failed to send the test email." };
  }
};
