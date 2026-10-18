import {
  type ExecutionContext,
  executionContextOf,
} from "@vitnode/core/api/lib/after-response";

export interface ApiBridgeEnv {
  clientAddress?: string;
}

export type ApiBridge = (
  request: Request,
  env?: ApiBridgeEnv,
  executionCtx?: ExecutionContext,
) => Promise<Response> | Response;

interface FetchableApp {
  fetch: (
    request: Request,
    env?: ApiBridgeEnv,
    executionCtx?: ExecutionContext,
  ) => Promise<Response> | Response;
}

// Without an explicit context the API runs on the incoming request's own
// `waitUntil`, so work it starts after the response is kept alive.
export const createApiBridge =
  (app: FetchableApp): ApiBridge =>
  async (request, env, executionCtx = executionContextOf(request)) =>
    app.fetch(request, env, executionCtx);
