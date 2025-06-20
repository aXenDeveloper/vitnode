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

  async send(args: {
    html: string;
    replyTo?: string;
    subject: string;
    to: string;
  }) {
    const core = this.c.get('core');
    const provider = core.emailAdapter;
    if (!provider) {
      throw new HTTPException(500, {
        message: 'Email provider not found',
      });
    }

    try {
      await provider.sendEmail({
        ...args,
        metadata: core.metadata,
      });
    } catch (e) {
      const error = e as Error;
      throw new HTTPException(500, {
        message: error.message,
      });
    }
  }
}
