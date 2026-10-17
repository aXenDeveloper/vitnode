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

/**
 * What an email adapter implements (e.g. `@vitnode/nodemailer`,
 * `@vitnode/resend`); set it as the API config's `email.adapter`.
 */
export interface EmailApiPlugin {
  /**
   * Sends one rendered email. Throw to fail the send: an email sent through
   * `EmailModel.send` is retried by its queue task when that task runs. `idempotencyKey`, when a
   * caller of `deliver` passes one, should reach providers that support it.
   */
  sendEmail: (args: {
    html: string;
    idempotencyKey?: string;
    metadata: ContextVariableMap["core"]["metadata"];
    replyTo?: string;
    subject: string;
    text: string;
    to: string;
    // oxlint-disable-next-line typescript/no-invalid-void-type
  }) => Promise<EmailSendResult | void>;
}

export interface EmailSendResult {
  id?: string;
}

/**
 * One email to send: to a user (in their own language) or to an address with
 * an explicit `locale`.
 */
export type EmailModelSendArgs = {
  /** The body, rendered inside the default template with the recipient's locale and messages. */
  content: (
    props: Omit<DefaultTemplateEmailProps, "children"> &
      Pick<EmailModelSendArgs, "user">,
  ) => React.ReactNode;
  html?: string;
  locale?: string;
  replyTo?: string;
  /** A string, or a function translating it with the recipient's locale and messages. */
  subject:
    | ((props: Pick<DefaultTemplateEmailProps, "i18n">) => string)
    | string;
} & (EmailModelSendArgsWithEmail | EmailModelSendArgsWithUser);

export interface BuiltEmail {
  html: string;
  replyTo?: string;
  subject: string;
  text: string;
  to: string;
}

/**
 * Renders React Email templates and sends them through the configured email
 * adapter, read in a route as `c.get("email")`.
 *
 * Emails are written in the recipient's language - the user's own, or the
 * `locale` given - falling back to the default locale when it is not offered,
 * never in the language of whoever triggered the send.
 */
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

  /**
   * Renders an email to HTML and plain text without sending it.
   *
   * @throws `HTTPException(400)` when there is no recipient address.
   */
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

  /**
   * Sends an already built email right away, through the adapter.
   *
   * @throws `HTTPException(500)` when no email adapter is configured.
   */
  async deliver(
    email: BuiltEmail,
    { idempotencyKey }: { idempotencyKey?: string } = {},
  ): Promise<EmailSendResult> {
    const provider = this.requireProvider();

    const sendResult = await provider.sendEmail({
      html: email.html,
      idempotencyKey,
      to: email.to,
      subject: email.subject,
      replyTo: email.replyTo,
      metadata: this.c.get("core").metadata,
      text: email.text,
    });

    return sendResult ?? {};
  }

  /**
   * Renders the email now and dispatches a `send-email` queue task - the
   * request does not wait for the provider. The task is queued under the
   * request's plugin (`c.get("plugin")`); core registers the `send-email`
   * handler under `@vitnode/core`.
   *
   * @throws `HTTPException(500)` when no email adapter is configured, and
   * `HTTPException(400)` when there is no recipient address.
   */
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
