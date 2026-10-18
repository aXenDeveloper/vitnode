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

export interface EmailApiPlugin {
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
