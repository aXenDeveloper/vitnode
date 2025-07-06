import type { Context, ContextVariableMap } from 'hono';

import { HTTPException } from 'hono/http-exception';

export interface EmailApiPlugin {
  sendEmail: (args: {
    html: string;
    metadata: ContextVariableMap['core']['metadata'];
    replyTo?: string;
    subject: string;
    to: string;
  }) => Promise<void>;
}

export interface EmailModelSendArgs {
  html: string;
  replyTo?: string;
  subject: string;
  to: string;
}

export class EmailModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  async send(args: EmailModelSendArgs) {
    const core = this.c.get('core');
    const provider = core.emailAdapter;
    if (!provider) {
      throw new HTTPException(500, {
        message: 'Email provider not found',
      });
    }

    await provider
      .sendEmail({
        ...args,
        metadata: core.metadata,
      })
      .catch((err: unknown) => {
        const error =
          err instanceof Error
            ? err
            : new Error('Unknown error from email provider');

        this.c.get('log').error(`Failed to send email: ${error.message}`);
      });
  }
}
