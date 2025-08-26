import { buildRoute } from "@vitnode/core/api/lib/route";
import { UserModel } from "@vitnode/core/api/models/user";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";
import TestTemplateEmail from "@/emails/test-template";

export const testRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: "post",
    description: "Test route",
    path: "/test",
    responses: {
      200: {
        content: {
          "text/plain": {
            schema: z.string(),
          },
        },
        description: "User",
      },
      201: {
        content: {
          "text/plain": {
            schema: z.string(),
          },
        },
        description: "User",
      },
    },
  },
  handler: async c => {
    const user = await new UserModel().getUserById({
      id: 3,
      c,
    });

    if (!user) throw new Error("User not found");

    await c.get("email").send({
      subject: "Test Email",
      content: TestTemplateEmail,
      user,
    });

    await c.get("log").warn("This is a test warn log");

    return c.text("test");
  },
});
