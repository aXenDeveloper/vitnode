import type { Context, Env, Next } from 'hono';

import { getCookie } from 'hono/cookie';

export const sessionMiddleware = () => {
  return async (c: Context<Env, '*'>, next: Next) => {
    // const secret = process.env.LOGIN_TOKEN_SECRET ?? '';
    // if (!secret) {
    //   throw new HTTPException(500, {
    //     message: 'LOGIN_TOKEN_SECRET not found in .env file',
    //   });
    // }

    const allCookies = getCookie(c);
    // eslint-disable-next-line no-console
    console.log('All cookies', allCookies);

    await next();
  };
};
