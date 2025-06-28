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

export class EmailModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  send(args: { html: string; replyTo?: string; subject: string; to: string }) {
    const core = this.c.get('core');
    const provider = core.emailAdapter;
    if (!provider) {
      throw new HTTPException(500, {
        message: 'Email provider not found',
      });
    }

    void provider
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
