import type { z } from "zod";

import type { zodSendTestEmailSchema } from "@/api/modules/admin/debug/routes/send-test-email.route";

import { fetcherClient } from "@/lib/fetcher-client";
import { debugAdminModuleRef } from "@/views/admin/views/core/system/integrations/integrations-query";

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
