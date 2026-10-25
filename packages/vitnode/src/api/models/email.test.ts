import type { Context } from "hono";

import { Hono } from "hono";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { EmailModelSendArgs } from "./email";

import { EmailModel } from "./email";

describe("EmailModel.build", () => {
  it("passes the core config's email tailwindConfig to the template", async () => {
    const tailwindConfig = {
      theme: { extend: { colors: { brand: "#0f766e" } } },
    };
    const logo = { text: "VitNode" };
    const content = vi.fn<EmailModelSendArgs["content"]>(() =>
      createElement("p", null, "Hello"),
    );

    const app = new Hono();
    app.use(async (c, next) => {
      c.set("core", {
        email: { logo, tailwindConfig },
        metadata: { shortTitle: "VitNode", title: "VitNode" },
      } as unknown as Context["var"]["core"]);
      c.set("i18n", {
        getMessages: async () => await Promise.resolve({}),
        resolveSupportedLocale: () => "en",
      } as unknown as Context["var"]["i18n"]);
      await next();
    });
    app.get("/", async c => {
      const email = await new EmailModel(c).build({
        content,
        locale: "en",
        subject: "Hi",
        to: "user@example.com",
      });

      return c.json(email);
    });

    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(content).toHaveBeenCalledOnce();
    expect(content.mock.calls[0]?.[0].templateProps).toMatchObject({
      logo,
      tailwindConfig,
    });
  });
});
