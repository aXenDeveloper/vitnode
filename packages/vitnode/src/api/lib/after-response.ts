import type { Context, ExecutionContext } from "hono";

export type { ExecutionContext };

type WaitUntil = (promise: Promise<unknown>) => void;

/**
 * The incoming request's `waitUntil`, as a Hono execution context. srvx (behind
 * TanStack Start and Nitro) puts it on the request; serverless presets wire it
 * to the platform, so work started after the response is not frozen with it.
 */
export const executionContextOf = (
  request: Request,
): ExecutionContext | undefined => {
  const { waitUntil } = request as Request & { waitUntil?: WaitUntil };
  if (typeof waitUntil !== "function") return undefined;

  return {
    passThroughOnException: () => undefined,
    props: {},
    waitUntil: promise => {
      waitUntil.call(request, promise);
    },
  };
};

/**
 * Lets `task` outlive the response. Where the runtime passed an execution
 * context its `waitUntil` keeps the work alive; a long-lived Node server just
 * lets the promise run. `task` must handle its own errors.
 */
export const runAfterResponse = (c: Context, task: Promise<unknown>): void => {
  let executionCtx: ExecutionContext | undefined;
  try {
    executionCtx = c.executionCtx;
  } catch {
    // Hono throws when the runtime passed no execution context.
  }
  executionCtx?.waitUntil(task);
};
