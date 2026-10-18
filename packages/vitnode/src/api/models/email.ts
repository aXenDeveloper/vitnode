import type { Context, ContextVariableMap } from "hono";
import type React from "react";

import { HTTPException } from "hono/http-exception";
import { render, toPlainText } from "react-email";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { runAfterResponse } from "@/api/lib/after-response";
import { processQueueTasksByIds } from "@/api/modules/queue/helpers/process-queue-tasks";

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
  /**
   * Returns the email's React tree, called with the recipient's locale and
   * messages plus the site's template props. Wrap it in `DefaultTemplateEmail`
   * yourself to get the standard layout. Ignored when `html` is given.
   */
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
  private readonly queued: number[] = [];

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

    // One React render: the plain-text part is the same conversion `render`
    // runs for `{ plainText: true }`, applied to the HTML we already have.
    const renderedHtml = await render(htmlContent);

    return {
      to: emailTo,
      subject:
        typeof subject === "function"
          ? subject({ i18n: { locale, messages } })
          : subject,
      html: renderedHtml,
      text: toPlainText(renderedHtml),
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
   * Deliver what this request queued right after the response, so a
   * verification or password-reset email doesn't wait for the next queue
   * cron tick. The queue row stays the durable fallback if this run fails.
   */
  flushAfterResponse(): void {
    const ids = this.queued.splice(0);
    if (ids.length === 0) return;

    runAfterResponse(
      this.c,
      processQueueTasksByIds(this.c as Context<EnvVitNode>, ids).catch(
        async (error: unknown) => {
          await this.c
            .get("log")
            .warn(
              `[Email] Immediate delivery deferred to the queue: ${error instanceof Error ? error.message : String(error)}`,
            );
        },
      ),
    );
  }

  /**
   * Renders the email now and queues core's `send-email` task (always under
   * `@vitnode/core`, so plugin routes work too) - the request does not wait
   * for the provider. Delivery is attempted right after the response, and the
   * queue retries it if that fails.
   *
   * @throws `HTTPException(500)` when no email adapter is configured, and
   * `HTTPException(400)` when there is no recipient address.
   */
  async send(args: EmailModelSendArgs): Promise<void> {
    this.requireProvider();
    const email = await this.build(args);

    const { id } = await this.c.get("queue").dispatch({
      name: "send-email",
      // The task is core's even when a plugin route sends the email.
      pluginId: "@vitnode/core",
      payload: {
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      },
    });
    if (id !== null) this.queued.push(id);
  }
}
