/** What the API's client-IP middleware reads off `c.env` for the socket address. */
export interface InProcessApiEnv {
  clientAddress?: string;
}

export type InProcessApiHandler = (
  request: Request,
  env?: InProcessApiEnv,
) => Promise<Response> | Response;

const HANDLER_KEY = Symbol.for("vitnode.fetcher.in-process-api");

type HandlerHolder = typeof globalThis & {
  [HANDLER_KEY]?: InProcessApiHandler;
};

/**
 * Registered by an app that mounts the VitNode API in its own process, so the
 * server-side fetcher hands it the `Request` instead of sending it over the
 * network and back through the app's own request pipeline. Kept on
 * `globalThis` because the app's server entry and the fetcher can load this
 * module from different chunks. Pass `undefined` to unregister.
 */
export const configureInProcessApi = (
  handler: InProcessApiHandler | undefined,
): void => {
  (globalThis as HandlerHolder)[HANDLER_KEY] = handler;
};

export const getInProcessApi = (): InProcessApiHandler | undefined =>
  (globalThis as HandlerHolder)[HANDLER_KEY];
