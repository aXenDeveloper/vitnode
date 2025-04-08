import { Context, ContextVariableMap, Env, Input } from 'hono';
import { HTTPException } from 'hono/http-exception';

export interface EmailApiPlugin {
  sendEmail: (args: {
    html: string;
    replyTo?: string;
    site: ContextVariableMap['core']['site'];
    subject: string;
    to: string;
  }) => Promise<void>;
}

export class EmailModel<T extends Env> {
  constructor(c: Context<T, '/', Input>) {
    this.c = c;
  }

  protected readonly c: Context<T, '/', Input>;

  isAvailable() {
    return !!this.c.get('core').emailProvider;
  }

  async send(args: {
    html: string;
    replyTo?: string;
    subject: string;
    to: string;
  }) {
    const core = this.c.get('core');
    const provider = core.emailProvider;
    if (!provider) {
      throw new HTTPException(500, {
        message: 'Email provider not found',
      });
    }

    try {
      await provider.sendEmail({
        ...args,
        site: core.site,
      });
    } catch (e) {
      const error = e as Error;
      throw new HTTPException(500, {
        message: error.message,
      });
    }
  }
}
