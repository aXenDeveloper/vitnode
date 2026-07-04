import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import TestEmailTemplate from "@/emails/test-email";

export const zodSendTestEmailSchema = z.object({
  content: z.string().min(1).max(5000),
  subject: z.string().min(1).max(200),
  to: z.email(),
});

export const sendTestEmailDebugAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "system", permission: "can_send_test_email" },
  route: {
    method: "post",
    description:
      "Send a test email to verify that the email adapter is configured correctly.",
    path: "/send-test-email",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodSendTestEmailSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean() }),
          },
        },
        description: "Test email sent",
      },
      400: {
        description: "Email adapter not configured",
      },
    },
  },
  handler: async c => {
    // The adapter check gives a clear error instead of the generic 500 the
    // email model would otherwise throw when no provider is configured.
    if (!c.get("core").email?.adapter) {
      throw new HTTPException(400, {
        message: "Email provider not configured",
      });
    }

    const { to, subject, content } = c.req.valid("json");

    await c.get("email").send({
      to,
      locale: "en",
      subject,
      content: props => TestEmailTemplate({ ...props, content }),
    });

    return c.json({ success: true });
  },
});
