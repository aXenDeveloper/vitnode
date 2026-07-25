import type { Context, ContextVariableMap } from "hono";
import type React from "react";

import { HTTPException } from "hono/http-exception";
import { render } from "react-email";

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
    ((props: Pick<DefaultTemplateEmailProps, "i18n">) => string) | string;
} & (EmailModelSendArgsWithEmail | EmailModelSendArgsWithUser);

export interface BuiltEmail {
  html: string;
  replyTo?: string;
  subject: string;
  text: string;
  to: string;
}

export class EmailModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  private requireProvider() {
    const provider = this.c.get("core").email?.adapter;
    if (!provider) {
      throw new HTTPException(500, {
        message: "Email provider not found",
      });
    }

    return provider;
  }

  async build({
    html,
    replyTo,
    subject,
    to,
    user,
    content,
    locale: localeFromArgs,
  }: EmailModelSendArgs): Promise<BuiltEmail> {
    const core = this.c.get("core");
    const i18n = this.c.get("i18n");

    // The recipient's own language decides, never the language of whoever
    // triggered the send - so this deliberately does not fall back to the
    // request. A language the app no longer ships lands on `defaultLocale`.
    const locale = i18n.resolveSupportedLocale(
      localeFromArgs ?? user?.language,
    );
    const messages = await i18n.getMessages(locale);

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

    return {
      to: emailTo,
      subject:
        typeof subject === "function"
          ? subject({ i18n: { locale, messages } })
          : subject,
      html: await render(htmlContent),
      text: await render(htmlContent, { plainText: true }),
      replyTo,
    };
  }

  async deliver(email: BuiltEmail): Promise<void> {
    const provider = this.requireProvider();

    await provider.sendEmail({
      html: email.html,
      to: email.to,
      subject: email.subject,
      replyTo: email.replyTo,
      metadata: this.c.get("core").metadata,
      text: email.text,
    });
  }

  async send(args: EmailModelSendArgs): Promise<void> {
    this.requireProvider();
    const email = await this.build(args);

    await this.c.get("queue").dispatch({
      name: "send-email",
      payload: {
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      },
    });
  }
}
