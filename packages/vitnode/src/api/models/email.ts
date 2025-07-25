import type { Context, ContextVariableMap } from 'hono';
import type React from 'react';

import { render } from '@react-email/components';
import { HTTPException } from 'hono/http-exception';

import DefaultTemplateEmail from '../../emails/default-template';
import { CONFIG } from '../../lib/config';

export interface EmailApiPlugin {
  sendEmail: (args: {
    html: string;
    metadata: ContextVariableMap['core']['metadata'];
    replyTo?: string;
    subject: string;
    text: string;
    to: string;
  }) => Promise<void>;
}

export interface EmailModelSendArgs {
  content: (props: { locale: string }) => React.ReactNode;
  html?: string;
  replyTo?: string;
  subject: string;
  to: string;
}

export class EmailModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  async send({ html, replyTo, subject, to, content }: EmailModelSendArgs) {
    const core = this.c.get('core');
    const provider = core.email?.adapter;
    if (!provider) {
      throw new HTTPException(500, {
        message: 'Email provider not found',
      });
    }

    const locale = 'en';
    const pluginIds: string[] = [
      '@vitnode/core',
      ...this.c.get('core').plugins.map(plugin => plugin.id),
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
      (acc, curr) => ({ ...acc, ...curr }),
      {},
    ) as Record<string, string>;

    const htmlContent =
      html ??
      DefaultTemplateEmail({
        children: content({ locale }),
        metadata: {
          ...core.metadata,
          url: CONFIG.web.href,
        },
        logo: core.email?.options?.logo,
        locale,
        messages,
      });

    try {
      await provider.sendEmail({
        html: await render(htmlContent),
        to,
        subject,
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
          : new Error('Unknown error from email provider');

      await this.c.get('log').error(`Failed to send email: ${error.message}`);
    }
  }
}
