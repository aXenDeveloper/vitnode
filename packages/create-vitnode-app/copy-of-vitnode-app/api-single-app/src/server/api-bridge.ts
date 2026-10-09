export interface ApiBridgeEnv {
  clientAddress?: string;
}

export type ApiBridge = (
  request: Request,
  env?: ApiBridgeEnv,
) => Promise<Response> | Response;

interface FetchableApp {
  fetch: (request: Request, env?: ApiBridgeEnv) => Promise<Response> | Response;
}

export const createApiBridge =
  (app: FetchableApp): ApiBridge =>
  async (request, env) =>
    app.fetch(request, env);
