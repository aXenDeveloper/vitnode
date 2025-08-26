import { render } from "@react-email/components";
import type { Context, ContextVariableMap } from "hono";
import { HTTPException } from "hono/http-exception";
import type React from "react";

import type { DefaultTemplateEmailProps } from "../../emails/default-template";
import { CONFIG } from "../../lib/config";

interface EmailModelSendArgsWithUser {
  locale?: never;
  to?: never;
  user: {
    email: string;
    id: number;
    language: string;
    name?: string;
    nameCode?: string;
  };
}

interface EmailModelSendArgsWithEmail {
  locale: string;
  to: string;
  user?: never;
}

export interface EmailApiPlugin {
  sendEmail: (args: {
    html: string;
    metadata: ContextVariableMap["core"]["metadata"];
    replyTo?: string;
    subject: string;
    text: string;
    to: string;
  }) => Promise<void>;
}

export type EmailModelSendArgs = {
  content: (
    props: Omit<DefaultTemplateEmailProps, "children"> &
      Pick<EmailModelSendArgs, "user">,
  ) => React.ReactNode;
  html?: string;
  locale?: string;
  replyTo?: string;
  subject:
    | ((props: Pick<DefaultTemplateEmailProps, "i18n">) => string)
    | string;
} & (EmailModelSendArgsWithEmail | EmailModelSendArgsWithUser);

export class EmailModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  async send({
    html,
    replyTo,
    subject,
    to,
    user,
    content,
    locale: localeFromArgs,
  }: EmailModelSendArgs) {
    const core = this.c.get("core");
    const provider = core.email?.adapter;
    if (!provider) {
      throw new HTTPException(500, {
        message: "Email provider not found",
      });
    }

    const locale = localeFromArgs ?? user?.language ?? "en";
    const pluginIds: string[] = [
      "@vitnode/core",
      ...this.c.get("core").plugins.map(plugin => plugin.id),
    ];

    const messagesPromises = pluginIds.map(async pluginId => {
      try {
        const path = `${pluginId}/${locale}.json`;
        const messages = await core.pathToMessages(path);

        return messages.default;
      } catch {
        return {};
      }
    });

    const allMessages = await Promise.all(messagesPromises);
    const messages = allMessages.reduce(
      // biome-ignore lint/performance/noAccumulatingSpread: <needed>
      (acc, curr) => ({ ...acc, ...curr }),
      {},
    ) as Record<string, string>;

    const htmlContent =
      html ??
      content({
        i18n: {
          locale,
          messages,
        },
        templateProps: {
          metadata: {
            ...core.metadata,
            url: CONFIG.web.href,
          },
          logo: core.email?.logo,
        },
        user,
      });

    const emailTo = user?.email ?? to;
    if (!emailTo) {
      throw new HTTPException(400, {
        message: "Email address is required",
      });
    }

    try {
      await provider.sendEmail({
        html: await render(htmlContent),
        to: emailTo,
        subject:
          typeof subject === "function"
            ? subject({ i18n: { locale, messages } })
            : subject,
        replyTo,
        metadata: core.metadata,
        text: await render(htmlContent, {
          plainText: true,
        }),
      });
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error("Unknown error from email provider");

      await this.c.get("log").error(`Failed to send email: ${error.message}`);
    }
  }
}
