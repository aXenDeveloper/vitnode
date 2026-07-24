"use server";

import type { z } from "zod";

import type { zodSendTestEmailSchema } from "@/api/modules/admin/debug/routes/send-test-email.route";

import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import { fetcher } from "@/lib/fetcher";

export const sendTestEmailMutation = async (
  body: z.infer<typeof zodSendTestEmailSchema>,
) => {
  const res = await fetcher(debugAdminModule, {
    prefixPath: "/admin",
    path: "/send-test-email",
    method: "post",
    module: "debug",
    args: {
      body,
    },
  });

  if (!res.ok) {
    return { error: await res.text() };
  }

  return { data: await res.json() };
};
