import type { Context, Env, Next } from 'hono';

export const sessionMiddleware = () => {
  return async (c: Context<Env, '*'>, next: Next) => {
    // const user = await new SessionModel(c).verifySession();
    // console.log('sessionMiddleware', user);

    await next();
  };
};
