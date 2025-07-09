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
  content: React.ReactNode;
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

    const htmlContent =
      html ??
      DefaultTemplateEmail({
        children: content,
        metadata: {
          ...core.metadata,
          url: CONFIG.web.href,
        },
        logo: core.email?.options?.logo,
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
