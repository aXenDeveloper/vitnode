"use server";

import type { z } from "zod";

import type { zodSendNotificationSchema } from "@/api/modules/admin/routes/notifications.route";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

export const sendNotificationMutation = async (
  body: z.infer<typeof zodSendNotificationSchema>,
) => {
  const res = await fetcher(adminModule, {
    path: "/notifications/send",
    method: "post",
    module: "admin",
    args: {
      body,
    },
  });

  if (!res.ok) {
    return { error: await res.text() };
  }
};
